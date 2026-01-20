import "../styles/Components/add-round-modal.scss"
import {useEffect, useState} from "react";
import HttpService from "../services/HttpService.ts";
import {HashLoader} from "react-spinners";
import toast from "react-simple-toasts";
import AddCourseModal from "./AddCourseModal.tsx";
import AddPlayerModal from "./AddPlayerModal.tsx";

const AddRoundModal = (props) => {
    const {onRoundCreated, onCloseModal} = props

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Course selection
    const [courses, setCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showAddCourseModal, setShowAddCourseModal] = useState(false);

    // Step 2: Player selection
    const [players, setPlayers] = useState([]);
    const [playerSearch, setPlayerSearch] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

    // Step 3: Handicap confirmation
    const [playerHandicaps, setPlayerHandicaps] = useState([]);

    // Step 4: Scoring method selection
    const [scoringMethods, setScoringMethods] = useState([]);
    const [selectedScoringMethod, setSelectedScoringMethod] = useState(null);

    // Fetch data on mount
    useEffect(() => {
        const fetchAddRoundData = async () => {
            const apiService = new HttpService();
            const {request} = await apiService.post('/get_create_round_data', {});

            request.then((response) => {
                setCourses(response.data.courses);
                setPlayers(response.data.players);
                setScoringMethods(response.data.scoring_methods);

            }, () => {
                toast('Could not get data', {theme: 'failure', duration: 3000});
            }).catch(() => {
                toast('Could not get data', {theme: 'failure', duration: 3000});
            })
        }

        fetchAddRoundData();
    }, []);


    // Initialize handicaps when moving to step 3
    useEffect(() => {
        if (currentStep === 3) {
            setPlayerHandicaps(selectedPlayers.map(player => ({
                ...player,
                roundHandicap: player.handicap
            })));
        }
    }, [currentStep, selectedPlayers]);

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(courseSearch.toLowerCase())
    );

    const filteredPlayers = players.filter(player =>
        player.name.toLowerCase().includes(playerSearch.toLowerCase())
    );

    const isStep1Valid = selectedCourse !== null;
    const isStep2Valid = selectedPlayers.length >= 1 && selectedPlayers.length <= 4;
    const isStep3Valid = playerHandicaps.every(p =>
        p.roundHandicap !== undefined &&
        p.roundHandicap >= 0 &&
        p.roundHandicap <= 54
    );
    const isStep4Valid = selectedScoringMethod !== null;

    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
    }

    const handlePlayerToggle = (player) => {
        const isSelected = selectedPlayers.some(p => p.id === player.id);
        if (isSelected) {
            setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
        } else if (selectedPlayers.length < 4) {
            setSelectedPlayers([...selectedPlayers, player]);
        } else {
            toast('Maximum 4 players allowed', {theme: 'failure', duration: 3000});
        }
    }

    const handleHandicapChange = (playerId, newHandicap) => {
        setPlayerHandicaps(playerHandicaps.map(p =>
            p.id === playerId ? {...p, roundHandicap: Number(newHandicap)} : p
        ));
    }

    const handleScoringMethodSelect = (method) => {
        setSelectedScoringMethod(method);
    }

    const handleCourseAdded = (newCourse) => {
        setCourses([...courses, newCourse]);
        setSelectedCourse(newCourse);
        setShowAddCourseModal(false);
    }

    const handlePlayerAdded = (newPlayer) => {
        setPlayers([...players, newPlayer]);
        if (selectedPlayers.length < 4) {
            setSelectedPlayers([...selectedPlayers, newPlayer]);
        }
        setShowAddPlayerModal(false);
    }

    const handleNextStep = () => {
        if (currentStep === 1 && isStep1Valid) {
            setCurrentStep(2);
        } else if (currentStep === 2 && isStep2Valid) {
            setCurrentStep(3);
        } else if (currentStep === 3 && isStep3Valid) {
            setCurrentStep(4);
        }
    }

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }

    const updatePlayerHandicaps = async () => {
        const apiService = new HttpService();
        const updatePromises = [];

        for (const player of playerHandicaps) {
            const originalPlayer = selectedPlayers.find(p => p.id === player.id);
            if (originalPlayer && originalPlayer.handicap !== player.roundHandicap) {
                const {request} = await apiService.post('/edit_player', {
                    player_id: player.id,
                    name: player.name,
                    handicap: player.roundHandicap
                });
                updatePromises.push(request);
            }
        }

        return Promise.all(updatePromises);
    }

    const handleCreateRound = async () => {
        setLoading(true);

        try {
            // First update any changed handicaps
            await updatePlayerHandicaps();

            // Then create the round
            const apiService = new HttpService();
            const roundPayload = {
                course_id: selectedCourse.id,
                player_ids: selectedPlayers.map(p => p.id),
                scoring_method_id: selectedScoringMethod.id,
                date: new Date().toISOString().split('T')[0]
            };

            const {request} = await apiService.post('/create_round', roundPayload);

            request.then(
                (response) => {
                    setLoading(false);
                    onRoundCreated(response?.data);
                },
                () => {
                    setLoading(false);
                    toast('Failed to create round', {theme: 'failure', duration: 3000});
                }
            ).catch(() => {
                setLoading(false);
                toast('Something has gone wrong', {theme: 'failure', duration: 3000});
            });
        } catch {
            setLoading(false);
            toast('Failed to update handicaps', {theme: 'failure', duration: 3000});
        }
    }

    if (loading) {
        return (
            <div className="login-container">
                <HashLoader color={"#155DFC"}/>
            </div>
        )
    }

    if (showAddCourseModal) {
        return (
            <AddCourseModal
                mode="add"
                onCourseAdded={handleCourseAdded}
                onCloseModal={() => setShowAddCourseModal(false)}
            />
        )
    }

    if (showAddPlayerModal) {
        return (
            <AddPlayerModal
                mode="add"
                onPlayerAdded={handlePlayerAdded}
                onCloseModal={() => setShowAddPlayerModal(false)}
            />
        )
    }

    return (
        <>
            <div className="modal-container">
                <div className="modal-content add-round-modal">
                    <div className="modal-header">
                        <div className="header">Create Round - Step {currentStep} of 4</div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    <div className="step-indicator">
                        <div
                            className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>1.
                            Course
                        </div>
                        <div
                            className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>2.
                            Players
                        </div>
                        <div
                            className={`step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>3.
                            Handicaps
                        </div>
                        <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>4. Scoring</div>
                    </div>

                    {/* Step 1: Select Course */}
                    {currentStep === 1 && (
                        <div className="step-content">
                            <div className="search-container">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search courses..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                />
                            </div>
                            <div className="selection-list">
                                {filteredCourses.map((course) => (
                                    <div
                                        key={course.id}
                                        className={`selection-item ${selectedCourse?.id === course.id ? 'selected' : ''}`}
                                        onClick={() => handleCourseSelect(course)}
                                    >
                                        {course.name}
                                    </div>
                                ))}
                                {filteredCourses.length === 0 && (
                                    <div className="no-results">No courses found</div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="button-secondary add-new-button"
                                onClick={() => setShowAddCourseModal(true)}
                            >
                                + Add New Course
                            </button>
                        </div>
                    )}

                    {/* Step 2: Select Players */}
                    {currentStep === 2 && (
                        <div className="step-content">
                            <div className="search-container">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search players..."
                                    value={playerSearch}
                                    onChange={(e) => setPlayerSearch(e.target.value)}
                                />
                            </div>
                            <div className="selected-info">
                                Selected: {selectedPlayers.length}/4 players
                            </div>
                            <div className="selection-list">
                                {filteredPlayers.map((player) => (
                                    <div
                                        key={player.id}
                                        className={`selection-item ${selectedPlayers.some(p => p.id === player.id) ? 'selected' : ''}`}
                                        onClick={() => handlePlayerToggle(player)}
                                    >
                                        <span>{player.name}</span>
                                        <span className="handicap-badge">HC: {player.handicap}</span>
                                    </div>
                                ))}
                                {filteredPlayers.length === 0 && (
                                    <div className="no-results">No players found</div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="button-secondary add-new-button"
                                onClick={() => setShowAddPlayerModal(true)}
                            >
                                + Add New Player
                            </button>
                        </div>
                    )}

                    {/* Step 3: Confirm Handicaps */}
                    {currentStep === 3 && (
                        <div className="step-content">
                            <div className="handicap-info">
                                <p>Confirm handicaps for <strong>{selectedCourse?.name}</strong></p>
                            </div>
                            <div className="handicap-list">
                                {playerHandicaps.map((player) => (
                                    <div key={player.id} className="handicap-item">
                                        <span className="player-name">{player.name}</span>
                                        <input
                                            type="number"
                                            className="handicap-input"
                                            value={player.roundHandicap}
                                            min="0"
                                            max="54"
                                            onChange={(e) => handleHandicapChange(player.id, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Select Scoring Method */}
                    {currentStep === 4 && (
                        <div className="step-content">
                            <div className="scoring-info">
                                <p>Select a scoring method for this round</p>
                            </div>
                            <div className="scoring-method-list">
                                {scoringMethods.map((method) => (
                                    <div
                                        key={method.id}
                                        className={`scoring-method-item ${selectedScoringMethod?.id === method.id ? 'selected' : ''}`}
                                        onClick={() => handleScoringMethodSelect(method)}
                                    >
                                        <div className="method-info">
                                            <span className="method-name">{method.name}</span>
                                            {method.description && (
                                                <span className="method-description">{method.description}</span>
                                            )}
                                        </div>
                                        <div
                                            className={`toggle ${selectedScoringMethod?.id === method.id ? 'active' : ''}`}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="modal-actions">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                className="button-secondary"
                                onClick={handlePrevStep}
                            >
                                Back
                            </button>
                        )}
                        {currentStep < 4 ? (
                            <button
                                type="button"
                                className="button-primary min-100"
                                disabled={
                                    (currentStep === 1 && !isStep1Valid) ||
                                    (currentStep === 2 && !isStep2Valid) ||
                                    (currentStep === 3 && !isStep3Valid)
                                }
                                onClick={handleNextStep}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="button-primary"
                                disabled={!isStep4Valid}
                                onClick={handleCreateRound}
                            >
                                Create Round
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default AddRoundModal
