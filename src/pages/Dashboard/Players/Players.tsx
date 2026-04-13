import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Players.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddPlayerModal from "../../../components/AddPlayerModal.tsx";
import ConfirmDialog from "../../../components/ConfirmDialog.tsx";
import golfBg from "../../../assets/golf-bg-2.jpg";
import toast from "react-simple-toasts";

interface Player {
    id: number;
    name: string;
    surname: string;
    phone: string | null;
    handicap: number;
    invite_code: string | null;
    is_registered: boolean;
}

const Players = () => {
    const [playerModalBool, setPlayerModalBool] = useState(false);
    const [playerModalMode, setPlayerModalMode] = useState<'add' | 'edit'>('add');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        playerId: number | null;
        playerName: string;
    }>({
        isOpen: false,
        playerId: null,
        playerName: ''
    });

    useEffect(() => {
        fetchPlayers();
    }, []);

    const fetchPlayers = async () => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.get("players");
            setPlayers(response.data.data || []);
        } catch (error: any) {
            console.error("Error fetching players:", error);
            toast("Failed to load players", { className: "error-toast" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPlayerClick = () => {
        setPlayerModalMode('add');
        setSelectedPlayer(null);
        setPlayerModalBool(true);
    }

    const handleEditPlayerClick = (player: Player) => {
        setPlayerModalMode('edit');
        setSelectedPlayer(player);
        setPlayerModalBool(true);
    }

    const handleCloseModalClick = () => {
        setPlayerModalBool(false);
        setSelectedPlayer(null);
    }

    const handlePlayerAdded = (newPlayer: Player) => {
        setPlayers((old) => [...old, newPlayer]);
        setPlayerModalBool(false);
        toast(`Player ${newPlayer.name} created! Invite code: ${newPlayer.invite_code}`, { className: "success-toast" });
    }

    const handlePlayerUpdated = (updatedPlayer: Player) => {
        setPlayers((old) => old.map(player => player.id === updatedPlayer.id ? updatedPlayer : player));
        setPlayerModalBool(false);
        setSelectedPlayer(null);
        toast("Player updated successfully", { className: "success-toast" });
    }

    const handleDeleteClick = (player: Player) => {
        setConfirmDialog({
            isOpen: true,
            playerId: player.id,
            playerName: `${player.name} ${player.surname}`
        });
    };

    const handleConfirmDelete = async () => {
        if (!confirmDialog.playerId) return;

        try {
            const httpService = new HttpService();
            await httpService.delete(`players/${confirmDialog.playerId}`);
            setPlayers((old) => old.filter(p => p.id !== confirmDialog.playerId));
            toast("Player deleted successfully", { className: "success-toast" });
        } catch (error: any) {
            console.error("Error deleting player:", error);
            toast(error.response?.data?.message || "Failed to delete player", { className: "error-toast" });
        } finally {
            setConfirmDialog({ isOpen: false, playerId: null, playerName: '' });
        }
    };

    const handleCancelDelete = () => {
        setConfirmDialog({ isOpen: false, playerId: null, playerName: '' });
    };

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

                    {isLoading ? (
                        <div className="loading-state">Loading players...</div>
                    ) : players.length === 0 ? (
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
                                            <div className="player-name">{player.name} {player.surname}</div>
                                            <div className="player-handicap">Handicap: {player.handicap}</div>
                                            {!player.is_registered && player.invite_code && (
                                                <div className="player-invite-code">Invite: {player.invite_code}</div>
                                            )}
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
                                        {!player.is_registered && (
                                            <button 
                                                className="action-btn delete" 
                                                onClick={() => handleDeleteClick(player)}
                                                title="Delete player"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        )}
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

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Delete Player"
                message={`Are you sure you want to delete ${confirmDialog.playerName}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    )
}
export default Players
