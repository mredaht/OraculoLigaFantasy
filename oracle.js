// oracle.js  

import "dotenv/config";
import Web3 from "web3";
import fs from "fs";
import retry from "async-retry";
import pLimit from "p-limit";
import leagueAbi from "./FantasyLeagueABI.json" with { type: "json" };

function env(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Falta ${name} en .env`);
    return v;
}

const web3 = new Web3(env("RPC_URL"));
const acct = web3.eth.accounts.privateKeyToAccount(env("ORACLE_PRIVATE_KEY"));
web3.eth.accounts.wallet.add(acct);
const league = new web3.eth.Contract(leagueAbi.abi, env("LEAGUE_ADDRESS"));

// ── parámetros ───────────────────────────────────────────
const GAS_LIMIT = 500_000;
const CONCURRENCY = 1;
const STATS_FILE = "./stats.json";

function loadStats() {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
}

// globals para métricas
let active = 0;
let totalGas = 0n;
let latencies = [];

// ── envío ────────────────────────────────────────────────
async function sendStat(p, nonce) {
    const tx = league.methods.actualizarEstadisticas(
        p.id, p.goles, p.asistencias, p.paradas, p.penaltisParados,
        p.despejes, p.minutosJugados, p.porteriaCero,
        p.tarjetasAmarillas, p.tarjetasRojas, p.ganoPartido
    );
    const encoded = tx.encodeABI();

    const block = await web3.eth.getBlock("pending");
    const base = BigInt(block.baseFeePerGas);
    const tip = 2n * 10n ** 9n;
    const maxFee = base * 2n + tip;

    const txData = {
        from: acct.address,
        to: league.options.address,
        gas: GAS_LIMIT,
        maxPriorityFeePerGas: tip.toString(),
        maxFeePerGas: maxFee.toString(),
        nonce,
        data: encoded
    };

    return retry(async () => {
        const start = Date.now();          //  tiempo de envío
        const signed = await acct.signTransaction(txData);
        const rcpt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        const latency = Date.now() - start;

        // recopilar métricas
        totalGas += BigInt(rcpt.gasUsed);
        latencies.push(latency);

        console.log(`id ${p.id}  gas=${rcpt.gasUsed}  ${latency} ms  (in-flight ${--active})`);
        return rcpt;
    }, {
        retries: 3,
        onRetry: (e, i) => console.log(`Reintentando id ${p.id} (${i})`)
    });
}

// ── Main ─────────────────────────────────────────────────
(async () => {
    const stats = loadStats();
    const limit = pLimit(CONCURRENCY);
    let nonce = await web3.eth.getTransactionCount(acct.address, "pending");

    console.time("batch");               // duración total

    const tasks = stats.map(p => limit(async () => {
        console.log(`→ id ${p.id}  (in-flight ${++active})`);
        return sendStat(p, nonce++);
    }));

    await Promise.all(tasks);
    console.timeEnd("batch");

    // resumen final
    const avgGas = Number(totalGas) / stats.length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / stats.length;

    console.log("\n── Resumen ─────────────────────");
    console.log(`Jugadores procesados : ${stats.length}`);
    console.log(`Gas total            : ${totalGas}`);
    console.log(`Gas medio / jugador  : ${avgGas}`);
    console.log(`Latencia media (ms)  : ${avgLatency.toFixed(0)}`);
    process.exit(0);
})();
