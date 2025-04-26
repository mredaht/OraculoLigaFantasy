// Oracle script for updating FantasyLeague stats on-chain
// -------------------------------------------------------
// 1. Lee el fichero stats.json (goles, asistencias, etc.)
// 2. Conecta a Sepolia a través de tu RPC (env RPC_URL)
// 3. Firma con tu PRIVATE_KEY y llama a `actualizarEstadisticas()`
// -------------------------------------------------------
// Uso:
//   RPC_URL=<rpc> PRIVATE_KEY=<pk> FANTASY_CONTRACT=<addr> node index.js [--from 0 --to 129]
// -------------------------------------------------------

import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ethers } from "ethers";

// ---- Config ----------------------------------------------------------------
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = process.env.RPC_URL;          // p. ej. https://sepolia.infura.io/v3/<API_KEY>
const PRIVATE_KEY = process.env.PRIVATE_KEY;      // clave de la wallet owner
const CONTRACT_ADDRESS = process.env.FANTASY_CONTRACT; // dirección FantasyLeague

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("❌  Faltan variables de entorno (RPC_URL, PRIVATE_KEY, FANTASY_CONTRACT)");
    process.exit(1);
}

// ---- Provider + signer ------------------------------------------------------
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// ---- ABI --------------------------------------------------------------------
// Para no inflar el script, leemos la ABI compilada a disco.  
// Genera un fichero FantasyLeagueABI.json con la ABI (solc/Foundry lo sacan en artifacts).
const ABI_PATH = path.join(__dirname, "FantasyLeagueABI.json");
const ABI = JSON.parse(await readFile(ABI_PATH, "utf8"));

const league = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// ---- CLI args (rango opcional) ---------------------------------------------
const args = process.argv.slice(2);
let from = 0;
let to = Number.MAX_SAFE_INTEGER;
for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--from") from = parseInt(args[i + 1]);
    if (args[i] === "--to") to = parseInt(args[i + 1]);
}

// ---- Carga stats ------------------------------------------------------------
const statsRaw = await readFile(path.join(__dirname, "stats.json"), "utf8");
const stats = JSON.parse(statsRaw);

// Validación ligera
await (async () => {
    if (!Array.isArray(stats)) throw new Error("stats.json debe ser un array");
})();

// ---- Función principal ------------------------------------------------------
async function main() {
    console.log("🔗 Provider:", await provider.getNetwork());
    console.log("🏢 Contrato:", CONTRACT_ADDRESS);
    console.log(`📑 Procesando jugadores del ${from} al ${to}`);

    for (const player of stats) {
        if (player.id < from || player.id > to) continue;

        try {
            const tx = await league.actualizarEstadisticas(
                player.id,
                player.goles,
                player.asistencias,
                player.paradas,
                player.penaltisParados,
                player.despejes,
                player.minutosJugados,
                player.porteriaCero,
                player.tarjetasAmarillas,
                player.tarjetasRojas,
                player.ganoPartido,
                { gasLimit: 250_000 }
            );

            console.log(`⚽  #${player.id} – ${player.nombre}  ➜  tx ${tx.hash}`);
            await tx.wait(1);
        } catch (err) {
            console.error(`❌  Fallo al actualizar id ${player.id}:`, err.reason || err);
        }
    }

    console.log("✅  Estadísticas actualizadas. ¡Jornada lista!");
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
