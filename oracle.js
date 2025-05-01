// oracle.js
require("dotenv").config();
const Web3 = require("web3");
const fs = require("fs");

// ─── CONFIG ────────────────────────────────────────────────
const STATS_FILE = "./stats.json";                  // ← tu JSON
const web3 = new Web3(process.env.RPC_URL);
const acct = web3.eth.accounts.privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(acct);

const leagueAbi = require("./FantasyLeague.json"); // ABI exportado de Etherscan
const league = new web3.eth.Contract(leagueAbi, process.env.LEAGUE_ADDRESS);

// ─── CARGAR STATS DESDE EL JSON ───────────────────────────
function loadStats() {
    const raw = fs.readFileSync(STATS_FILE, "utf-8");
    const stats = JSON.parse(raw);

    // Normalizar claves (algunas entradas usan nombre/equipo)
    return stats.map(p => ({
        id: p.id,
        goles: p.goles,
        asistencias: p.asistencias,
        paradas: p.paradas,
        penaltisParados: p.penaltisParados,
        despejes: p.despejes,
        minutosJugados: p.minutosJugados,
        porteriaCero: p.porteriaCero,
        tarjetasAmarillas: p.tarjetasAmarillas,
        tarjetasRojas: p.tarjetasRojas,
        ganoPartido: p.ganoPartido
    }));
}

// ─── PUBLICAR UNA ACTUALIZACIÓN ───────────────────────────
async function pushStat(p) {
    const tx = league.methods.actualizarEstadisticas(
        p.id,
        p.goles,
        p.asistencias,
        p.paradas,
        p.penaltisParados,
        p.despejes,
        p.minutosJugados,
        p.porteriaCero,
        p.tarjetasAmarillas,
        p.tarjetasRojas,
        p.ganoPartido
    );

    const gas = await tx.estimateGas({ from: acct.address });
    const nonce = await web3.eth.getTransactionCount(acct.address);

    const receipt = await tx.send({
        from: acct.address,
        gas,
        nonce
    });

    console.log(` Jugador ${p.id} → Tx ${receipt.transactionHash}`);
}

// ─── MAIN LOOP ────────────────────────────────────────────
(async () => {
    const players = loadStats();

    for (const p of players) {
        try {
            await pushStat(p);
        } catch (err) {
            console.error(`  Error con id ${p.id}: ${err.message}`);
        }
    }
    process.exit(0);
})();
