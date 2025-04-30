require("dotenv").config();
const Web3 = require("web3");
const axios = require("axios");
const fs = require("fs");

// ─── CONFIG ───────────────────────────────────────────────────────────────
const web3 = new Web3(process.env.RPC_URL);
const acct = web3.eth.accounts.privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(acct);

const leagueAbi = JSON.parse(fs.readFileSync("./FantasyLeague.json"));
const league = new web3.eth.Contract(leagueAbi, process.env.LEAGUE_ADDRESS);

// ─── 1. OBTENER DATOS OFF-CHAIN ───────────────────────────────────────────
async function fetchStats(tokenId) {
    // Ejemplo: API ficticia
    const { data } = await axios.get(`https://api.futbol.io/player/${tokenId}`);
    return {
        goles: data.goals,
        asistencias: data.assists,
        paradas: data.saves,
        penaltisParados: data.penalties_saved,
        despejes: data.clearances,
        minutosJugados: data.minutes,
        porteriaCero: data.clean_sheet,
        tarjetasAmarillas: data.yellow,
        tarjetasRojas: data.red,
        ganoPartido: data.team_won
    };
}

// ─── 2. PUBLICAR EN CONTRATO ─────────────────────────────────────────────
async function updateOne(tokenId) {
    const s = await fetchStats(tokenId);

    const tx = league.methods.actualizarEstadisticas(
        tokenId,
        s.goles, s.asistencias, s.paradas, s.penaltisParados,
        s.despejes, s.minutosJugados, s.porteriaCero,
        s.tarjetasAmarillas, s.tarjetasRojas, s.ganoPartido
    );

    const gas = await tx.estimateGas({ from: acct.address });
    const nonce = await web3.eth.getTransactionCount(acct.address);

    const txData = {
        from: acct.address,
        to: process.env.LEAGUE_ADDRESS,
        data: tx.encodeABI(),
        gas,
        nonce
    };

    const receipt = await web3.eth.sendTransaction(txData);
    console.log(`✅ Player ${tokenId} actualizado. Tx: ${receipt.transactionHash}`);
}

// ─── 3. BUCLE PARA VARIOS JUGADORES ───────────────────────────────────────
async function main() {
    // ids = [0,1,2,3,4]  ← los cinco titulares del equipo, o todos los NFT
    const ids = [0, 1, 2, 3, 4];

    for (const id of ids) {
        try {
            await updateOne(id);
        } catch (e) {
            console.error(`⚠️  Error con id ${id}:`, e.message);
        }
    }
    process.exit(0);
}

main();
