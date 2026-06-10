import "../styles/Components/add-round-modal.scss"
import {useEffect, useRef, useState} from "react";
import HttpService from "../services/HttpService.ts";
import StorageService from "../services/StorageService.ts";
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

    // The logged-in user — surfaced as a "You" quick-pick (the creator usually plays)
    const [currentUser] = useState(() => new StorageService().getUser());

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

    // "You" quick-pick: the logged-in user, shaped like a player row
    const currentUserPlayer = currentUser
        ? {...currentUser, name: `${currentUser.name} ${currentUser.surname || ''}`.trim()}
        : null;
    const isCurrentUserSelected = currentUserPlayer
        ? selectedPlayers.some(p => p.id === currentUserPlayer.id)
        : false;
    const showYou = !!currentUserPlayer && !isCurrentUserSelected && matchesSearch(currentUserPlayer);
    // While shown under "You", hide the user from the regular lists to avoid a duplicate.
    // Once they're selected, "You" disappears and they appear normally (and can be deselected there).
    const hiddenUserId = currentUserPlayer && !isCurrentUserSelected ? currentUserPlayer.id : null;

    const friendIds = new Set(friends.map(f => f.id));
    const filteredFriends = friends.filter(f => f.id !== hiddenUserId && matchesSearch(f));
    const filteredOtherPlayers = players.filter(player =>
        !friendIds.has(player.id) && player.id !== hiddenUserId && matchesSearch(player)
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
            setPlayerSearch(''); // clear the filter so the next player is easy to find
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
        } else if (currentStep === 4 && isStep4Valid && selectedScoringMethod?.id !== 1) {
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

            // Stroke Play is always individual, regardless of any earlier format choice
            const effectiveFormat = selectedScoringMethod?.id === 1 ? 'individual' : selectedFormat;

            let teamsData: { name: string; playerIds: number[] }[] | undefined;
            if (effectiveFormat === 'teams') {
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
                format: effectiveFormat,
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

    const getInitials = (name: string): string => {
        return (name || '')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?';
    }

    const adjustHandicap = (playerId: number, delta: number) => {
        setPlayerHandicaps(prev => prev.map(p => {
            if (p.id !== playerId) return p;
            const next = Math.min(54, Math.max(0, (Number(p.roundHandicap) || 0) + delta));
            return {...p, roundHandicap: next};
        }));
    }

    // Press-and-hold to repeat, accelerating the longer it's held
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopHold = () => {
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
    }

    const startHold = (playerId: number, delta: number) => {
        stopHold();
        adjustHandicap(playerId, delta); // immediate first step
        let delay = 350;
        const tick = () => {
            adjustHandicap(playerId, delta);
            delay = Math.max(45, delay - 35); // speed up on each repeat
            holdTimer.current = setTimeout(tick, delay);
        };
        holdTimer.current = setTimeout(tick, delay);
        // Safety: always stop on release, even if the button became disabled mid-hold
        window.addEventListener('pointerup', stopHold, {once: true});
        window.addEventListener('pointercancel', stopHold, {once: true});
    }

    // Clear any running hold timer if the modal unmounts mid-press
    useEffect(() => stopHold, []);

    // Stroke Play (id 1) is individual-only, so it has no Format step
    const isStrokePlay = selectedScoringMethod?.id === 1;
    const steps = isStrokePlay
        ? ['Course', 'Players', 'Handicap', 'Scoring']
        : ['Course', 'Players', 'Handicap', 'Scoring', 'Format'];
    const lastStep = steps.length;

    const checkIcon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
             strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );

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
                <div className="modal-content round-wizard">
                    <div className="round-wizard__header">
                        <div className="round-wizard__heading">
                            <span className="round-wizard__title">Create Round</span>
                            <span className="round-wizard__step">Step {currentStep} of {lastStep} · {steps[currentStep - 1]}</span>
                        </div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    <div className="round-stepper">
                        {steps.map((label, i) => {
                            const n = i + 1;
                            const state = currentStep > n ? 'is-done' : currentStep === n ? 'is-active' : 'is-upcoming';
                            return (
                                <div key={label} className={`round-step ${state}`}>
                                    <div className="round-step__dot">
                                        {currentStep > n ? checkIcon : n}
                                    </div>
                                    <div className="round-step__label">{label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Step 1: Select Course */}
                    {currentStep === 1 && (
                        <div className="step-content">
                            <div className="round-search">
                                <svg className="round-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search courses..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                />
                            </div>
                            <div className="select-list">
                                {filteredCourses.map((course) => (
                                    <button
                                        type="button"
                                        key={course.id}
                                        className={`select-card ${selectedCourse?.id === course.id ? 'is-selected' : ''}`}
                                        onClick={() => handleCourseSelect(course)}
                                    >
                                        <div className="select-card__main">
                                            <span className="select-card__title">{course.name}</span>
                                            {course.location && (
                                                <span className="select-card__sub">{course.location}</span>
                                            )}
                                        </div>
                                        <span className="select-card__check">{checkIcon}</span>
                                    </button>
                                ))}
                                {filteredCourses.length === 0 && (
                                    <div className="no-results">No courses found</div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="round-add-btn"
                                onClick={() => setShowAddCourseModal(true)}
                            >
                                <span className="round-add-btn__plus">+</span> Add New Course
                            </button>

                            {selectedCourse && selectedCourse.tees && selectedCourse.tees.length > 0 && (
                                <div className="tee-picker">
                                    <div className="tee-picker__label">Select Tee</div>
                                    <div className="tee-chips">
                                        {selectedCourse.tees.map((tee) => (
                                            <button
                                                type="button"
                                                key={tee.id}
                                                className={`tee-chip ${selectedCourseTeeId === tee.id ? 'is-selected' : ''}`}
                                                onClick={() => setSelectedCourseTeeId(tee.id)}
                                            >
                                                <span className="tee-chip__dot" style={{backgroundColor: tee.colour_code || '#ccc'}} />
                                                {tee.tee_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Select Players */}
                    {currentStep === 2 && (
                        <div className="step-content">
                            <div className="round-search">
                                <svg className="round-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search players..."
                                    value={playerSearch}
                                    onChange={(e) => setPlayerSearch(e.target.value)}
                                />
                            </div>
                            <div className="select-summary">
                                <span className="select-summary__count">{selectedPlayers.length}/4 selected</span>
                                {selectedPlayers.length > 0 && (
                                    <div className="select-summary__avatars">
                                        {selectedPlayers.map((p) => (
                                            <span key={p.id} className="player-avatar" title={p.name}>{getInitials(p.name)}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="select-list">
                                {showYou && (
                                    <>
                                        <div className="select-list__header">You</div>
                                        <button
                                            type="button"
                                            className="select-card"
                                            onClick={() => handlePlayerToggle(currentUserPlayer)}
                                        >
                                            <span className="player-avatar">{getInitials(currentUserPlayer.name)}</span>
                                            <div className="select-card__main">
                                                <span className="select-card__title">{currentUserPlayer.name}</span>
                                                {currentUserPlayer.phone && <span className="select-card__sub">{currentUserPlayer.phone}</span>}
                                            </div>
                                            <span className="round-hcp"><b>{currentUserPlayer.handicap}</b><i>HCP</i></span>
                                            <span className="select-card__check">{checkIcon}</span>
                                        </button>
                                    </>
                                )}
                                {filteredFriends.length > 0 && (
                                    <>
                                        <div className="select-list__header">Friends</div>
                                        {filteredFriends.map((player) => {
                                            const sel = selectedPlayers.some(p => p.id === player.id);
                                            return (
                                                <button
                                                    type="button"
                                                    key={player.id}
                                                    className={`select-card ${sel ? 'is-selected' : ''}`}
                                                    onClick={() => handlePlayerToggle(player)}
                                                >
                                                    <span className="player-avatar">{getInitials(player.name)}</span>
                                                    <div className="select-card__main">
                                                        <span className="select-card__title">{player.name}</span>
                                                        {player.phone && <span className="select-card__sub">{player.phone}</span>}
                                                    </div>
                                                    <span className="round-hcp"><b>{player.handicap}</b><i>HCP</i></span>
                                                    <span className="select-card__check">{checkIcon}</span>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                                {filteredOtherPlayers.length > 0 && (
                                    <>
                                        {filteredFriends.length > 0 && <div className="select-list__header">Other Players</div>}
                                        {filteredOtherPlayers.map((player) => {
                                            const sel = selectedPlayers.some(p => p.id === player.id);
                                            return (
                                                <button
                                                    type="button"
                                                    key={player.id}
                                                    className={`select-card ${sel ? 'is-selected' : ''}`}
                                                    onClick={() => handlePlayerToggle(player)}
                                                >
                                                    <span className="player-avatar">{getInitials(player.name)}</span>
                                                    <div className="select-card__main">
                                                        <span className="select-card__title">{player.name}</span>
                                                        {player.phone && <span className="select-card__sub">{player.phone}</span>}
                                                    </div>
                                                    <span className="round-hcp"><b>{player.handicap}</b><i>HCP</i></span>
                                                    <span className="select-card__check">{checkIcon}</span>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                                {!showYou && filteredFriends.length === 0 && filteredOtherPlayers.length === 0 && (
                                    <div className="no-results">No players found</div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="round-add-btn"
                                onClick={() => setShowAddPlayerModal(true)}
                            >
                                <span className="round-add-btn__plus">+</span> Add New Player
                            </button>
                        </div>
                    )}

                    {/* Step 3: Confirm Handicaps */}
                    {currentStep === 3 && (
                        <div className="step-content">
                            <p className="step-hint">Confirm playing handicaps for <strong>{selectedCourse?.name}</strong></p>
                            <div className="hcp-list">
                                {playerHandicaps.map((player) => (
                                    <div key={player.id} className="hcp-row">
                                        <span className="player-avatar">{getInitials(player.name)}</span>
                                        <span className="hcp-row__name">{player.name}</span>
                                        <div className="hcp-stepper">
                                            <button
                                                type="button"
                                                className="hcp-stepper__btn"
                                                onPointerDown={(e) => { e.preventDefault(); startHold(player.id, -1); }}
                                                onPointerUp={stopHold}
                                                onPointerLeave={stopHold}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); adjustHandicap(player.id, -1); } }}
                                                disabled={player.roundHandicap <= 0}
                                                aria-label="Decrease handicap"
                                            >−</button>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                className="hcp-stepper__value"
                                                value={player.roundHandicap}
                                                min="0"
                                                max="54"
                                                onChange={(e) => handleHandicapChange(player.id, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="hcp-stepper__btn"
                                                onPointerDown={(e) => { e.preventDefault(); startHold(player.id, 1); }}
                                                onPointerUp={stopHold}
                                                onPointerLeave={stopHold}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); adjustHandicap(player.id, 1); } }}
                                                disabled={player.roundHandicap >= 54}
                                                aria-label="Increase handicap"
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Select Scoring Method */}
                    {currentStep === 4 && (
                        <div className="step-content">
                            <p className="step-hint">Choose how you'll keep score</p>
                            <div className="method-list">
                                {scoringMethods.map((method) => (
                                    <button
                                        type="button"
                                        key={method.id}
                                        className={`method-card ${selectedScoringMethod?.id === method.id ? 'is-selected' : ''}`}
                                        onClick={() => handleScoringMethodSelect(method)}
                                    >
                                        <div className="method-card__main">
                                            <span className="method-card__name">{method.name}</span>
                                            {method.description && (
                                                <span className="method-card__desc">{method.description}</span>
                                            )}
                                        </div>
                                        <span className="select-card__check">{checkIcon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Select Format */}
                    {currentStep === 5 && (
                        <div className="step-content">
                            <p className="step-hint">Pick the format for this round</p>

                            <div className="format-options">
                                <button
                                    type="button"
                                    className={`format-card ${selectedFormat === 'individual' ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedFormat('individual')}
                                >
                                    <div className="format-card__main">
                                        <span className="format-card__name">Individual</span>
                                        <span className="format-card__desc">Each player plays for themselves</span>
                                    </div>
                                    <span className="select-card__check">{checkIcon}</span>
                                </button>

                                {canSelectTeams && (
                                    <button
                                        type="button"
                                        className={`format-card ${selectedFormat === 'teams' ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedFormat('teams')}
                                    >
                                        <div className="format-card__main">
                                            <span className="format-card__name">Teams</span>
                                            <span className="format-card__desc">
                                                {selectedPlayers.length === 2 ? 'Both players on one team' : 'Two teams of two'}
                                            </span>
                                        </div>
                                        <span className="select-card__check">{checkIcon}</span>
                                    </button>
                                )}
                            </div>

                            {selectedFormat === 'teams' && selectedPlayers.length === 2 && (
                                <div className="team-config">
                                    <div className="team-config__label">Team Name</div>
                                    <input
                                        type="text"
                                        className="team-config__input"
                                        value={teamNames[0]}
                                        onChange={(e) => setTeamNames([e.target.value, ''])}
                                        placeholder="Enter team name"
                                    />
                                </div>
                            )}

                            {selectedFormat === 'teams' && selectedPlayers.length === 4 && (
                                <div className="team-config">
                                    <div className="team-setup">
                                        <div className="team-col">
                                            <input
                                                type="text"
                                                className="team-config__input"
                                                value={teamNames[0]}
                                                onChange={(e) => setTeamNames([e.target.value, teamNames[1]])}
                                                placeholder="Team 1 name"
                                            />
                                            {selectedPlayers.map(player => (
                                                <label
                                                    key={player.id}
                                                    htmlFor={`player-${player.id}`}
                                                    className={`team-pick ${playerAssignments[player.id] === 0 ? 'is-on' : ''}`}
                                                >
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
                                                    <span className="team-pick__avatar">{getInitials(player.name)}</span>
                                                    <span className="team-pick__name">{player.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="team-col">
                                            <input
                                                type="text"
                                                className="team-config__input"
                                                value={teamNames[1]}
                                                onChange={(e) => setTeamNames([teamNames[0], e.target.value])}
                                                placeholder="Team 2 name"
                                            />
                                            {selectedPlayers.map(player => (
                                                <label
                                                    key={player.id}
                                                    htmlFor={`player-2-${player.id}`}
                                                    className={`team-pick ${playerAssignments[player.id] === 1 ? 'is-on' : ''}`}
                                                >
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
                                                    <span className="team-pick__avatar">{getInitials(player.name)}</span>
                                                    <span className="team-pick__name">{player.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="round-actions">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                className="round-btn round-btn--ghost"
                                onClick={handlePrevStep}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                                Back
                            </button>
                        )}
                        {currentStep < lastStep ? (
                            <button
                                type="button"
                                className="round-btn round-btn--next"
                                disabled={
                                    (currentStep === 1 && !isStep1Valid) ||
                                    (currentStep === 2 && !isStep2Valid) ||
                                    (currentStep === 3 && !isStep3Valid) ||
                                    (currentStep === 4 && !isStep4Valid)
                                }
                                onClick={handleNextStep}
                            >
                                Next
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="round-btn round-btn--create"
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
