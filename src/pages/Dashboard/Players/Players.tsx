import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Players.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddFriendModal from "../../../components/AddFriendModal.tsx";
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

const Friends = () => {
    const [friendModalBool, setFriendModalBool] = useState(false);
    const [editModalBool, setEditModalBool] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [friends, setFriends] = useState<Player[]>([]);
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
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        setIsLoading(true);
        try {
            const httpService = new HttpService();
            const response = await httpService.get("friends");
            setFriends(response.data.data || []);
        } catch (error: any) {
            console.error("Error fetching friends:", error);
            toast("Failed to load friends", { className: "error-toast" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddFriendClick = () => {
        setSelectedPlayer(null);
        setFriendModalBool(true);
    }

    const handleEditFriendClick = (player: Player) => {
        setSelectedPlayer(player);
        setEditModalBool(true);
    }

    const handleCloseFriendModal = () => {
        setFriendModalBool(false);
    }

    const handleCloseEditModal = () => {
        setEditModalBool(false);
        setSelectedPlayer(null);
    }

    const handleFriendAdded = (newFriend: Player) => {
        setFriends((old) => [...old, newFriend]);
        setFriendModalBool(false);
        toast(`Friend ${newFriend.name} added!`, { className: "success-toast" });
    }

    const handleFriendUpdated = (updatedFriend: Player) => {
        setFriends((old) => old.map(friend => friend.id === updatedFriend.id ? updatedFriend : friend));
        setEditModalBool(false);
        setSelectedPlayer(null);
        toast("Friend updated successfully", { className: "success-toast" });
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
            await httpService.delete(`friends/${confirmDialog.playerId}`);
            setFriends((old) => old.filter(p => p.id !== confirmDialog.playerId));
            toast("Friend removed successfully", { className: "success-toast" });
        } catch (error: any) {
            console.error("Error removing friend:", error);
            toast(error.response?.data?.message || "Failed to remove friend", { className: "error-toast" });
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
                        <h1>👥 Friends</h1>
                        <span className="count-badge">{friends.length} friend{friends.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="action-bar">
                        <button className="button-primary" onClick={handleAddFriendClick}>
                            <span style={{marginRight: '8px'}}>➕</span> Add Friend
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="loading-state">Loading friends...</div>
                    ) : friends.length === 0 ? (
                        <div className="empty-state-glass">
                            <div className="empty-icon">🏌️</div>
                            <h3>No Friends Yet</h3>
                            <p>Add your first friend to get started</p>
                        </div>
                    ) : (
                        <div className="players-grid">
                            {friends.map((friend) => (
                                <div key={friend.id} className="player-card glass-card">
                                    <div className="card-header">
                                        <div className="player-avatar">🏌️</div>
                                        <div className="player-info">
                                            <div className="player-name">{friend.name} {friend.surname}</div>
                                            <div className="player-handicap">Handicap: {friend.handicap}</div>
                                            {!friend.is_registered && friend.invite_code && (
                                                <div className="player-invite-code">Invite: {friend.invite_code}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button 
                                            className="action-btn edit" 
                                            onClick={() => handleEditFriendClick(friend)}
                                            title="Edit friend"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        {!friend.is_registered && (
                                            <button 
                                                className="action-btn delete" 
                                                onClick={() => handleDeleteClick(friend)}
                                                title="Remove friend"
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

            {friendModalBool && <AddFriendModal
                onFriendAdded={handleFriendAdded}
                onCloseModal={handleCloseFriendModal}
            ></AddFriendModal>}

            {editModalBool && <AddPlayerModal
                mode={'edit'}
                player={selectedPlayer}
                onCloseModal={handleCloseEditModal}
                onPlayerUpdated={handleFriendUpdated}
            ></AddPlayerModal>}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title="Remove Friend"
                message={`Are you sure you want to remove ${confirmDialog.playerName}? This action cannot be undone.`}
                confirmText="Remove"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    )
}
export default Friends
