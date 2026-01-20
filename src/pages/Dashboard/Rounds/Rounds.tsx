import {useEffect, useState} from 'react'
import HttpService from "../../../services/HttpService.ts";

import toast from 'react-simple-toasts';
import 'react-simple-toasts/dist/style.css';
import 'react-simple-toasts/dist/theme/failure.css';
import {HashLoader} from "react-spinners";
import "../../../styles/Pages/Rounds.scss"
import AddRoundModal from "../../../components /AddRoundModal.tsx";

const Rounds = () => {
    const [rounds, setRounds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRoundModal, setShowRoundModal] = useState(false);

    useEffect(() => {
        const getRounds = async () => {
            setRounds([]);
            const apiService = new HttpService();
            const {request} = await apiService.post('/get_rounds', {});

            request.then((response) => {
                console.log(response);
                setLoading(false);
                setRounds(response.data);
            }, () => {
                setLoading(false);
                toast('Could not get the rounds', {theme: 'failure', duration: 3000});
            }).catch(() => {
                setLoading(false);
                toast('Could not get the rounds', {theme: 'failure', duration: 3000});
            })


        }

        getRounds()

    }, []);

    const handleAddRoundClick = () => {
        setShowRoundModal(true);
    }

    const handleCloseModalClick = () => {
        setShowRoundModal(false);
    }

    const handleRoundCreated = ($event) => {
        console.log($event);
        setRounds((old) => [...old, $event]);
        setShowRoundModal(false);
    }

    const handleViewRoundClick = (round) => {
        console.log('View round:', round);
        // TODO: Navigate to round details or open view modal
    }

    const handleEditRoundClick = (round) => {
        console.log('Edit round:', round);
        // TODO: Navigate to round edit or open edit modal
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
                <div className="rounds-container">
                    <div className="table-container">
                        <div className="table-header">
                            <div className="table-cell">Course</div>
                            <div className="table-cell">Date</div>
                            <div className="table-cell">Actions</div>
                        </div>
                        {rounds.map((round, index) => (
                            <div key={index} className="table-row">
                                <div className="table-cell">{round.course.name}</div>
                                <div className="table-cell">{formatDate(round.date)}</div>
                                <div className="table-cell">
                                    {round.completed ? (
                                        <button className="button-secondary"
                                                onClick={() => handleViewRoundClick(round)}>View</button>
                                    ) : (
                                        <button className="button-secondary"
                                                onClick={() => handleEditRoundClick(round)}>Edit</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="action-buttons">
                        <button className="button-primary" onClick={handleAddRoundClick}>Create round</button>
                    </div>
                </div>
                {showRoundModal && <AddRoundModal
                    onCloseModal={handleCloseModalClick}
                    onRoundCreated={handleRoundCreated}
                ></AddRoundModal>}

            </>
        )
    }

}
export default Rounds
