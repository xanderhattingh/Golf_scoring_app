import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Players.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddFriendModal from "../../../components/AddFriendModal.tsx";
import AddPlayerModal from "../../../components/AddPlayerModal.tsx";
import ConfirmDialog from "../../../components/ConfirmDialog.tsx";
import AuthCrest from "../../../components/AuthCrest.tsx";
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

    const getInitials = (player: Player): string => {
        const first = player.name?.charAt(0) || '';
        const last = player.surname?.charAt(0) || '';
        return (first + last).toUpperCase() || '?';
    };

    return (
        <div className="page-with-background">
            <div 
                className="page-background" 
                style={{ backgroundImage: `url(${golfBg})` }}
            />
            <div className="page-content">
                <div className="players-container">
                    <header className="clubhouse-header">
                        <div className="clubhouse-header__crest">
                            <AuthCrest />
                        </div>
                        <div className="clubhouse-header__titles">
                            <h1>Friends</h1>
                            <span className="clubhouse-header__sub">
                                {friends.length} player{friends.length !== 1 ? 's' : ''} on your roster
                            </span>
                        </div>
                    </header>

                    <div className="friends-toolbar">
                        <button className="btn-friend btn-friend--add" onClick={handleAddFriendClick}>
                            <span className="btn-friend__plus">+</span> Add Friend
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="roster-grid">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="roster-card roster-card--skeleton" />
                            ))}
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="friends-empty">
                            <div className="friends-empty__crest">
                                <AuthCrest />
                            </div>
                            <h3>No friends yet</h3>
                            <p>Add your playing partners to set up rounds and track handicaps.</p>
                            <button className="btn-friend btn-friend--add" onClick={handleAddFriendClick}>
                                <span className="btn-friend__plus">+</span> Add Friend
                            </button>
                        </div>
                    ) : (
                        <div className="roster-grid">
                            {friends.map((friend) => (
                                <article key={friend.id} className="roster-card">
                                    <div className="roster-card__top">
                                        <div className="roster-card__avatar">{getInitials(friend)}</div>
                                        <div className="roster-card__info">
                                            <h2>{friend.name} {friend.surname}</h2>
                                            {friend.phone && (
                                                <div className="roster-card__phone">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                         strokeLinejoin="round">
                                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                    </svg>
                                                    {friend.phone}
                                                </div>
                                            )}
                                        </div>
                                        <div className="roster-card__hcp">
                                            <span className="roster-card__hcp-num">{friend.handicap}</span>
                                            <span className="roster-card__hcp-lbl">HCP</span>
                                        </div>
                                    </div>

                                    <div className="roster-card__foot">
                                        {friend.is_registered ? (
                                            <span className="roster-tag roster-tag--member">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                                     strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                                Member
                                            </span>
                                        ) : friend.invite_code ? (
                                            <span className="roster-tag roster-tag--invite">
                                                Invite · {friend.invite_code}
                                            </span>
                                        ) : (
                                            <span className="roster-tag roster-tag--guest">Guest</span>
                                        )}

                                        <div className="roster-card__actions">
                                            <button
                                                className="roster-card__btn"
                                                onClick={() => handleEditFriendClick(friend)}
                                                title="Edit friend"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            {!friend.is_registered && (
                                                <button
                                                    className="roster-card__btn roster-card__btn--danger"
                                                    onClick={() => handleDeleteClick(friend)}
                                                    title="Remove friend"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
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
