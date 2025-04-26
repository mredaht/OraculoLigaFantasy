// index-web3.js
// ──────────────────────────────────────────────────────────────
// Oráculo para actualizar las estadísticas de FantasyLeague
// usando web3.js (v4) + HTTP RPC
// ──────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import Web3 from 'web3';
import minimist from 'minimist';

dotenv.config();

// ─── CONFIG ──────────────────────────────────────────────────
const {
    RPC_URL,          // tu endpoint Sepolia / Alchemy / Infura
    PRIVATE_KEY,      // la clave de la cuenta Owner (0x…)
    FANTASY_CONTRACT  // dirección del contrato FantasyLeague
} = process.env;

if (!RPC_URL || !PRIVATE_KEY || !FANTASY_CONTRACT) {
    console.error('Falta RPC_URL, PRIVATE_KEY o FANTASY_CONTRACT en .env');
    process.exit(1);
}

// Rango opcional vía CLI:  node index-web3.js --from 20 --to 40
const { from = 0, to = 1e9 } = minimist(process.argv.slice(2));

// ─── CARGAR DATOS ────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const abi = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'FantasyLeagueABI.json'), 'utf8')
);

const stats = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'stats.json'), 'utf8')
);

// ─── WEB3 SETUP ──────────────────────────────────────────────
const web3 = new Web3(RPC_URL);
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

const contract = new web3.eth.Contract(abi, FANTASY_CONTRACT);

// Gas tip (puedes ajustar manual/automático)
async function gasParams() {
    const [price, block] = await Promise.all([
        web3.eth.getGasPrice(),
        web3.eth.getBlock('latest')
    ]);
    return {
        gasPrice: price,
        gas: Math.round(block.gasLimit / 4)          // margen de seguridad
    };
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────
async function main() {
    console.log(`\n Actualizando stats de ${FANTASY_CONTRACT}`);
    console.log(`Cuenta firmante: ${account.address}\n`);

    const slice = stats.slice(from, to + 1);
    console.log(`Procesando jugadores ${from} → ${to}  (total ${slice.length})\n`);

    for (const p of slice) {
        const {
            id,
            goles,
            asistencias,
            paradas,
            penaltisParados,
            despejes,
            minutosJugados,
            porteriaCero,
            tarjetasAmarillas,
            tarjetasRojas,
            ganoPartido
        } = p;

        const params = [
            id,
            goles,
            asistencias,
            paradas,
            penaltisParados,
            despejes,
            minutosJugados,
            porteriaCero,
            tarjetasAmarillas,
            tarjetasRojas,
            ganoPartido
        ];

        try {
            const txCfg = await gasParams();
            const receipt = await contract.methods
                .actualizarEstadisticas(...params)
                .send({ ...txCfg, from: account.address });

            console.log(
                `#${id.toString().padEnd(3)} ${p.name.padEnd(18)} → tx ${receipt.transactionHash.slice(0, 10)}…`
            );
        } catch (err) {
            console.error(`Error en jugador ${id} (${p.name}):`, err.message);
            // Decide si sigues o paras
        }
    }

    console.log('\n  ¡Jornada actualizada!\n');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
