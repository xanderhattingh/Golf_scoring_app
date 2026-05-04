import "../styles/Components/add-round-modal.scss"
import {useEffect, useState} from "react";
import HttpService from "../services/HttpService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';
import AddCourseModal from "./AddCourseModal.tsx";
import AddPlayerModal from "./AddPlayerModal.tsx";

const AddRoundModal = (props) => {
    const {onRoundCreated, onCloseModal} = props

    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Course selection
    const [courses, setCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedCourseTeeId, setSelectedCourseTeeId] = useState<number | null>(null);
    const [showAddCourseModal, setShowAddCourseModal] = useState(false);

    // Step 2: Player selection
    const [players, setPlayers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [playerSearch, setPlayerSearch] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);

    // Step 3: Handicap confirmation
    const [playerHandicaps, setPlayerHandicaps] = useState([]);

    // Step 4: Scoring method selection
    const [scoringMethods, setScoringMethods] = useState([]);
    const [selectedScoringMethod, setSelectedScoringMethod] = useState(null);

    // Step 5: Format selection
    const [selectedFormat, setSelectedFormat] = useState<'individual' | 'teams'>('individual');
    const [teamNames, setTeamNames] = useState<string[]>(['', '']);
    const [playerAssignments, setPlayerAssignments] = useState<Record<number, number>>({});

    // Fetch data on mount
    useEffect(() => {
        const httpService = new HttpService();
        Promise.all([
            httpService.get('courses'),
            httpService.get('players'),
            httpService.get('friends'),
            httpService.get('scoring-methods'),
        ])
            .then(([coursesRes, playersRes, friendsRes, methodsRes]) => {
                const courseData = coursesRes.data?.data || [];
                const playerData = (playersRes.data?.data || []).map((p: any) => ({
                    ...p,
                    name: `${p.name} ${p.surname || ''}`.trim(),
                }));
                const friendData = (friendsRes.data?.data || []).map((p: any) => ({
                    ...p,
                    name: `${p.name} ${p.surname || ''}`.trim(),
                    isFriend: true,
                }));
                setCourses(courseData);
                setPlayers(playerData);
                setFriends(friendData);
                setScoringMethods(methodsRes.data?.data || []);
            })
            .catch(() => {
                toast('Failed to load data', {theme: 'failure', duration: 3000});
            });
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

    // Reset format when moving to step 5
    useEffect(() => {
        if (currentStep === 5) {
            // Reset format state when entering step 5
            if (selectedPlayers.length === 3) {
                setSelectedFormat('individual');
            }
        }
    }, [currentStep, selectedPlayers.length]);

    const filteredCourses = courses.filter(course =>
        course.name.toLowerCase().includes(courseSearch.toLowerCase())
    );

    const searchWords = playerSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = (player: any) => {
        if (searchWords.length === 0) return true;
        const fullName = `${player.name} ${player.surname || ''}`.toLowerCase().trim();
        return searchWords.every((word: string) =>
            player.name.toLowerCase().includes(word) ||
            (player.surname && player.surname.toLowerCase().includes(word)) ||
            (player.phone && player.phone.toLowerCase().includes(word)) ||
            fullName.includes(word)
        );
    };

    const friendIds = new Set(friends.map(f => f.id));
    const filteredFriends = friends.filter(matchesSearch);
    const filteredOtherPlayers = players.filter(player =>
        !friendIds.has(player.id) && matchesSearch(player)
    );

    const canSelectTeams = selectedPlayers.length === 2 || selectedPlayers.length === 4;

    const isStep1Valid = selectedCourse !== null && selectedCourseTeeId !== null;
    const isStep2Valid = selectedPlayers.length >= 1 && selectedPlayers.length <= 4;
    const isStep3Valid = playerHandicaps.every(p =>
        p.roundHandicap !== undefined &&
        p.roundHandicap >= 0 &&
        p.roundHandicap <= 54
    );
    const isStep4Valid = selectedScoringMethod !== null;

    const isStep5Valid = () => {
        if (selectedFormat === 'individual') return true;
        if (selectedPlayers.length === 2) {
            return teamNames[0]?.trim().length > 0;
        }
        if (selectedPlayers.length === 4) {
            const allAssigned = selectedPlayers.every(p => playerAssignments[p.id] !== undefined);
            const bothNamed = teamNames[0]?.trim().length > 0 && teamNames[1]?.trim().length > 0;
            const team1Count = Object.values(playerAssignments).filter(t => t === 0).length;
            const team2Count = Object.values(playerAssignments).filter(t => t === 1).length;
            return allAssigned && bothNamed && team1Count === 2 && team2Count === 2;
        }
        return true;
    };

    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        setSelectedCourseTeeId(course?.tees?.length === 1 ? course.tees[0].id : null);
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
        setPlayerHandicaps(prev => prev.map(p =>
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
        } else if (currentStep === 4 && isStep4Valid) {
            setCurrentStep(5);
        }
    }

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }

    const updatePlayerHandicaps = async () => {
        const httpService = new HttpService();

        for (const player of playerHandicaps) {
            const originalPlayer = selectedPlayers.find(p => p.id === player.id);
            if (originalPlayer && originalPlayer.handicap !== player.roundHandicap) {
                try {
                    await httpService.put(`players/${player.id}`, {
                        handicap: player.roundHandicap,
                    });
                } catch (e) {
                    // Ignore permission errors for registered users
                    console.error(e);
                }
            }
        }
    }

    const handleCreateRound = async () => {
        try {
            await updatePlayerHandicaps();

            let teamsData: { name: string; playerIds: number[] }[] | undefined;
            if (selectedFormat === 'teams') {
                if (selectedPlayers.length === 2) {
                    teamsData = [{
                        name: teamNames[0],
                        playerIds: selectedPlayers.map(p => p.id)
                    }];
                } else if (selectedPlayers.length === 4) {
                    teamsData = [
                        {
                            name: teamNames[0],
                            playerIds: selectedPlayers
                                .filter(p => playerAssignments[p.id] === 0)
                                .map(p => p.id)
                        },
                        {
                            name: teamNames[1],
                            playerIds: selectedPlayers
                                .filter(p => playerAssignments[p.id] === 1)
                                .map(p => p.id)
                        }
                    ];
                }
            }

            const playerHandicapsMap: Record<number, number> = {};
            playerHandicaps.forEach(p => {
                playerHandicapsMap[p.id] = p.roundHandicap;
            });

            const httpService = new HttpService();
            const response = await httpService.post('rounds', {
                course_id: selectedCourse.id,
                course_tee_id: selectedCourseTeeId,
                player_ids: selectedPlayers.map(p => p.id),
                player_handicaps: playerHandicapsMap,
                scoring_method_id: selectedScoringMethod.id,
                date: new Date().toISOString().split('T')[0],
                format: selectedFormat,
                teams: teamsData,
                starting_hole: 1,
            });

            if (response.data?.success) {
                onRoundCreated(response.data.data);
            } else {
                toast(response.data?.message || 'Failed to create round', {theme: 'failure', duration: 3000});
            }
        } catch (error: any) {
            console.error("Create round error:", error);
            toast(error.response?.data?.message || 'Failed to create round', {theme: 'failure', duration: 3000});
        }
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
                        <div className="header">Create Round - Step {currentStep} of 5</div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    <div className="step-indicator">
                        <div
                            className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                            Course
                        </div>
                        <div
                            className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                            Players
                        </div>
                        <div
                            className={`step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
                            HDC
                        </div>
                        <div
                            className={`step ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
                            Method
                        </div>
                        <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>Format</div>
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

                            {selectedCourse && selectedCourse.tees && selectedCourse.tees.length > 0 && (
                                <div className="tee-selection" style={{marginTop: '20px'}}>
                                    <label>Select Tee</label>
                                    <div className="selection-list">
                                        {selectedCourse.tees.map((tee) => (
                                            <div
                                                key={tee.id}
                                                className={`selection-item ${selectedCourseTeeId === tee.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedCourseTeeId(tee.id)}
                                            >
                                                {tee.tee_name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                {filteredFriends.length > 0 && (
                                    <>
                                        <div className="section-header">Friends</div>
                                        {filteredFriends.map((player) => (
                                            <div
                                                key={player.id}
                                                className={`selection-item ${selectedPlayers.some(p => p.id === player.id) ? 'selected' : ''}`}
                                                onClick={() => handlePlayerToggle(player)}
                                            >
                                                <div className="player-info-row">
                                                    <span className="player-name">{player.name}</span>
                                                    {player.phone && <span className="player-phone">{player.phone}</span>}
                                                </div>
                                                <span className="handicap-badge">HC: {player.handicap}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {filteredOtherPlayers.length > 0 && (
                                    <>
                                        {filteredFriends.length > 0 && <div className="section-header">Other Players</div>}
                                        {filteredOtherPlayers.map((player) => (
                                            <div
                                                key={player.id}
                                                className={`selection-item ${selectedPlayers.some(p => p.id === player.id) ? 'selected' : ''}`}
                                                onClick={() => handlePlayerToggle(player)}
                                            >
                                                <div className="player-info-row">
                                                    <span className="player-name">{player.name}</span>
                                                    {player.phone && <span className="player-phone">{player.phone}</span>}
                                                </div>
                                                <span className="handicap-badge">HC: {player.handicap}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {filteredFriends.length === 0 && filteredOtherPlayers.length === 0 && (
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
                                            inputMode="numeric"
                                            pattern="[0-9]*"
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

                    {/* Step 5: Select Format */}
                    {currentStep === 5 && (
                        <div className="step-content">
                            <div className="format-info">
                                <p>Select the format for this round</p>
                            </div>

                            <div className="format-options">
                                <div
                                    className={`format-option ${selectedFormat === 'individual' ? 'selected' : ''}`}
                                    onClick={() => setSelectedFormat('individual')}
                                >
                                    <span className="format-name">Individual</span>
                                    <span className="format-description">Each player plays for themselves</span>
                                </div>

                                {canSelectTeams && (
                                    <div
                                        className={`format-option ${selectedFormat === 'teams' ? 'selected' : ''}`}
                                        onClick={() => setSelectedFormat('teams')}
                                    >
                                        <span className="format-name">Teams</span>
                                        <span className="format-description">
                                            {selectedPlayers.length === 2 ? 'Both players on one team' : 'Two teams'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {selectedFormat === 'teams' && selectedPlayers.length === 2 && (
                                <div className="team-config">
                                    <label>Team Name</label>
                                    <input
                                        type="text"
                                        value={teamNames[0]}
                                        onChange={(e) => setTeamNames([e.target.value, ''])}
                                        placeholder="Enter team name"
                                    />
                                </div>
                            )}

                            {selectedFormat === 'teams' && selectedPlayers.length === 4 && (
                                <div className="team-config">
                                    <div className="team-setup">
                                        <div className="team">
                                            <input
                                                type="text"
                                                value={teamNames[0]}
                                                onChange={(e) => setTeamNames([e.target.value, teamNames[1]])}
                                                placeholder="Team 1 name"
                                            />
                                            {selectedPlayers.map(player => (
                                                <div key={player.id} className="player-assignment">
                                                    <input
                                                        id={`player-${player.id}`}
                                                        type="radio"
                                                        name={`player-${player.id}`}
                                                        checked={playerAssignments[player.id] === 0}
                                                        onChange={() => {
                                                            setPlayerAssignments({
                                                                ...playerAssignments,
                                                                [player.id]: 0
                                                            });
                                                            if (teamNames[0].length == 0) {
                                                                setTeamNames([player.name + "'s team", teamNames[1]])
                                                            }

                                                        }}
                                                    />
                                                    <label htmlFor={`player-${player.id}`}>{player.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="team">
                                            <input
                                                type="text"
                                                value={teamNames[1]}
                                                onChange={(e) => setTeamNames([teamNames[0], e.target.value])}
                                                placeholder="Team 2 name"
                                            />
                                            {selectedPlayers.map(player => (
                                                <div key={player.id} className="player-assignment">
                                                    <input
                                                        id={`player-2-${player.id}`}
                                                        type="radio"
                                                        name={`player-${player.id}`}
                                                        checked={playerAssignments[player.id] === 1}
                                                        onChange={() => {
                                                            setPlayerAssignments({
                                                                ...playerAssignments,
                                                                [player.id]: 1
                                                            });
                                                            if (teamNames[1].length == 0) {
                                                                setTeamNames([teamNames[0], player.name + "'s team"])
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`player-2-${player.id}`}>{player.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
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
                        {currentStep < 5 ? (
                            <button
                                type="button"
                                className="button-primary min-100"
                                disabled={
                                    (currentStep === 1 && !isStep1Valid) ||
                                    (currentStep === 2 && !isStep2Valid) ||
                                    (currentStep === 3 && !isStep3Valid) ||
                                    (currentStep === 4 && !isStep4Valid)
                                }
                                onClick={handleNextStep}
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="button-primary"
                                disabled={!isStep5Valid()}
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
