import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import {HashLoader} from "react-spinners";
import "../../../styles/Pages/Players.scss"
import AddPlayerModal from "../../../components /AddPlayerModal.tsx";

const Players = () => {
    const [addPlayerModalBool, setAddPlayerModalBool] = useState(false);
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
        setAddPlayerModalBool(true);
    }

    const handleCloseModalClick = () => {
        setAddPlayerModalBool(false);
    }

    const handlePlayerAdded = ($event) => {
        console.log($event);
        setPlayers((old) => [...old, $event]);
        setAddPlayerModalBool(false)
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
                {players.map((player, index) => (
                    <div key={index} className="player" style={{color: 'white'}}>
                        {player.name}
                    </div>
                ))}
                <div className="players-container">
                    <div className="action-buttons">
                        <button className="button-primary" onClick={handleAddPlayerClick}>Add player</button>
                    </div>

                </div>
                {addPlayerModalBool && <AddPlayerModal onCloseModal={handleCloseModalClick}
                                                       onPlayerAdded={handlePlayerAdded}></AddPlayerModal>}

            </>
        )
    }

}
export default Players
