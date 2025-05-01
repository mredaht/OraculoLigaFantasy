// oracle.js
import "dotenv/config";
import fs from "fs";
import Web3 from "web3";
import retry from "async-retry";
import pLimit from "p-limit";
import leagueAbi from "./artifacts/FantasyLeague.sol/FantasyLeague.json" assert { type: "json" };

function env(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Falta ${name} en .env`);
    return v;
}

const web3 = new Web3(env("RPC_URL"));
const acct = web3.eth.accounts.privateKeyToAccount(env("ORACLE_PRIVATE_KEY"));
web3.eth.accounts.wallet.add(acct);

const league = new web3.eth.Contract(
    leagueAbi.abi,
    env("LEAGUE_ADDRESS")
);

// ── Utils ────────────────────────────────────────────────
const GAS_LIMIT = 250_000;                // margen holgado
const CONCURRENCY = 5;                    // 5 tx simultáneas
const STATS_FILE = "./stats.json";

function loadStats() {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
}

async function sendStat(p, nonce) {
    const tx = league.methods.actualizarEstadisticas(
        p.id, p.goles, p.asistencias, p.paradas, p.penaltisParados,
        p.despejes, p.minutosJugados, p.porteriaCero,
        p.tarjetasAmarillas, p.tarjetasRojas, p.ganoPartido
    );

    const encoded = tx.encodeABI();

    const txData = {
        from: acct.address,
        to: league.options.address,
        gas: GAS_LIMIT,
        nonce,
        data: encoded,
        maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"),  // EIP-1559 ejemplo
        maxFeePerGas: web3.utils.toWei("40", "gwei")
    };

    return retry(async () => {
        const signed = await acct.signTransaction(txData);
        return web3.eth.sendSignedTransaction(signed.rawTransaction);
    }, {
        retries: 3,
        onRetry: (e, i) => console.log(`Reintentando id ${p.id} (${i})`),
    });
}

// ── Main ─────────────────────────────────────────────────
(async () => {
    const stats = loadStats();
    const limit = pLimit(CONCURRENCY);
    let nonce = await web3.eth.getTransactionCount(acct.address, "pending");

    const tasks = stats.map(p => limit(() => sendStat(p, nonce++)));

    for await (const rcpt of tasks) {
        console.log(`tx ${rcpt.transactionHash} incluida`);
    }
    process.exit(0);
})();
