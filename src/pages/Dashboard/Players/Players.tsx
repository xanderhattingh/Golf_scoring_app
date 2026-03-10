import {useEffect, useState} from 'react'
import LocalDataService from "../../../services/LocalDataService.ts";

import "../../../styles/Pages/Players.scss"
import AddPlayerModal from "../../../components/AddPlayerModal.tsx";

const Players = () => {
    const [playerModalBool, setPlayerModalBool] = useState(false);
    const [playerModalMode, setPlayerModalMode] = useState<'add' | 'edit'>('add');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [players, setPlayers] = useState([]);

    useEffect(() => {
        const dataService = new LocalDataService();
        setPlayers(dataService.getPlayers());
    }, []);

    const handleAddPlayerClick = () => {
        setPlayerModalMode('add');
        setSelectedPlayer(null);
        setPlayerModalBool(true);
    }

    const handleEditPlayerClick = (player) => {
        setPlayerModalMode('edit');
        setSelectedPlayer(player);
        setPlayerModalBool(true);
    }

    const handleCloseModalClick = () => {
        setPlayerModalBool(false);
        setSelectedPlayer(null);
    }

    const handlePlayerAdded = ($event) => {
        setPlayers((old) => [...old, $event]);
        setPlayerModalBool(false)
    }

    const handlePlayerUpdated = ($event) => {
        setPlayers((old) => old.map(player => player.id === $event.id ? $event : player));
        setPlayerModalBool(false);
        setSelectedPlayer(null);
    }


    return (
        <>
            <div className="players-container">
                <div className="table-container">
                    <div className="table-header">
                        <div className="table-cell">Name</div>
                        <div className="table-cell">Handicap</div>
                        <div className="table-cell">Actions</div>
                    </div>
                    {players.map((player, index) => (
                        <div key={index} className="table-row">
                            <div className="table-cell">{player.name}</div>
                            <div className="table-cell">{player.handicap}</div>
                            <div className="table-cell">
                                <button className="button-secondary"
                                        onClick={() => handleEditPlayerClick(player)}>Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="action-buttons">
                    <button className="button-primary" onClick={handleAddPlayerClick}>Add player</button>
                </div>

            </div>
            {playerModalBool && <AddPlayerModal
                mode={playerModalMode}
                player={selectedPlayer}
                onCloseModal={handleCloseModalClick}
                onPlayerAdded={handlePlayerAdded}
                onPlayerUpdated={handlePlayerUpdated}
            ></AddPlayerModal>}

        </>
    )

}
export default Players
