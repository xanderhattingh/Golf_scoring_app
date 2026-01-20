import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import {HashLoader} from "react-spinners";
import "../../../styles/Pages/Players.scss"
import AddPlayerModal from "../../../components /AddPlayerModal.tsx";

const Players = () => {
    const [playerModalBool, setPlayerModalBool] = useState(false);
    const [playerModalMode, setPlayerModalMode] = useState<'add' | 'edit'>('add');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getPlayers = async () => {
            setPlayers([]);
            const apiService = new HttpService();
            const {request} = await apiService.post('/get_players', {});

            request.then((response) => {
                console.log(response);
                setLoading(false);
                setPlayers(response.data);
            }, () => {
                setLoading(false);
                toast('Could not get the players', {theme: 'failure', duration: 3000});
            }).catch(() => {
                setLoading(false);
                toast('Could not get the players', {theme: 'failure', duration: 3000});
            })


        }

        getPlayers()

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
        console.log($event);
        setPlayers((old) => [...old, $event]);
        setPlayerModalBool(false)
    }

    const handlePlayerUpdated = ($event) => {
        console.log($event);
        setPlayers((old) => old.map(player => player.id === $event.id ? $event : player));
        setPlayerModalBool(false);
        setSelectedPlayer(null);
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    if (loading) {
        return (
            <div className="login-container">
                <HashLoader color={"#155DFC"}/>
            </div>
        )
    } else {

        return (
            <>
                <div className="players-container">
                    <div className="table-container">
                        <div className="table-header">
                            <div className="table-cell">Name</div>
                            <div className="table-cell">Handicap</div>
                            <div className="table-cell">Created At</div>
                            <div className="table-cell">Actions</div>
                        </div>
                        {players.map((player, index) => (
                            <div key={index} className="table-row">
                                <div className="table-cell">{player.name}</div>
                                <div className="table-cell">{player.handicap}</div>
                                <div className="table-cell">{formatDate(player.created_at)}</div>
                                <div className="table-cell">
                                    <button className="button-secondary" onClick={() => handleEditPlayerClick(player)}>Edit</button>
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

}
export default Players
