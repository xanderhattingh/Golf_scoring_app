import {useEffect, useState} from 'react'
import LocalDataService from "../../../services/LocalDataService.ts";

import "../../../styles/Pages/Players.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddPlayerModal from "../../../components/AddPlayerModal.tsx";
import golfBg from "../../../assets/golf-bg-2.jpg";

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
        <div className="page-with-background">
            <div 
                className="page-background" 
                style={{ backgroundImage: `url(${golfBg})` }}
            />
            <div className="page-content">
                <div className="players-container">
                    <div className="page-header-glass">
                        <h1>👥 Players</h1>
                        <span className="count-badge">{players.length} player{players.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="action-bar">
                        <button className="button-primary" onClick={handleAddPlayerClick}>
                            <span style={{marginRight: '8px'}}>➕</span> Add Player
                        </button>
                    </div>

                    {players.length === 0 ? (
                        <div className="empty-state-glass">
                            <div className="empty-icon">🏌️</div>
                            <h3>No Players Yet</h3>
                            <p>Add your first player to get started</p>
                        </div>
                    ) : (
                        <div className="players-grid">
                            {players.map((player) => (
                                <div key={player.id} className="player-card glass-card">
                                    <div className="card-header">
                                        <div className="player-avatar">🏌️</div>
                                        <div className="player-info">
                                            <div className="player-name">{player.name}</div>
                                            <div className="player-handicap">{player.handicap}</div>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button 
                                            className="action-btn edit" 
                                            onClick={() => handleEditPlayerClick(player)}
                                            title="Edit player"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {playerModalBool && <AddPlayerModal
                mode={playerModalMode}
                player={selectedPlayer}
                onCloseModal={handleCloseModalClick}
                onPlayerAdded={handlePlayerAdded}
                onPlayerUpdated={handlePlayerUpdated}
            ></AddPlayerModal>}
        </div>
    )
}
export default Players
