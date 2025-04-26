
import players from './players.json';

// Funciones utiles

export const getAllPlayers = () => {
    return players;
};

export const getPlayersByTeam = (teamName) => {
    return players.filter(player => player.team.toLowerCase() === teamName.toLowerCase());
};

export const getPlayerByName = (playerName) => {
    return players.find(player => player.name.toLowerCase() === playerName.toLowerCase());
};

// Ejemplos de uso:
// console.log(getAllPlayers());
// console.log(getPlayersByTeam('Barcelona'));
// console.log(getPlayerByName('Lewandowski'));

export default players;