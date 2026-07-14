import "../styles/Components/add-round-modal.scss"
import {useEffect, useRef, useState} from "react";
import HttpService from "../services/HttpService.ts";
import StorageService from "../services/StorageService.ts";
import toast from "react-simple-toasts";
import 'react-simple-toasts/dist/style.css';
import AddPlayerModal from "./AddPlayerModal.tsx";

const AddRoundModal = (props) => {
    const {onRoundCreated, onCloseModal} = props

    const [currentStep, setCurrentStep] = useState(1);

    // How the round is being started: pick everything yourself, or join a tournament by code
    const [mode, setMode] = useState<'intro' | 'create' | 'join'>('intro');
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const [isLookingUp, setIsLookingUp] = useState(false);
    // The tournament resolved from the invite code (locks course, tee & scoring)
    const [tournament, setTournament] = useState<any | null>(null);

    // Step 1: Course selection
    const [courses, setCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedCourseTeeId, setSelectedCourseTeeId] = useState<number | null>(null);

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

    // Four Ball Alliance: how many scores count per hole, by par
    const [allianceCounts, setAllianceCounts] = useState<{par3: number; par4: number; par5: number}>({par3: 4, par4: 4, par5: 4});

    // The logged-in user — surfaced as a "You" quick-pick (the creator usually plays)
    const [currentUser] = useState(() => new StorageService().getUser());

    // Course search results (server-side; courses aren't preloaded — there are too many)
    const [isSearchingCourses, setIsSearchingCourses] = useState(false);

    // Fetch data on mount (everything except courses, which are searched on demand)
    useEffect(() => {
        const httpService = new HttpService();
        Promise.all([
            httpService.get('players'),
            httpService.get('friends'),
            httpService.get('scoring-methods'),
        ])
            .then(([playersRes, friendsRes, methodsRes]) => {
                const playerData = (playersRes.data?.data || []).map((p: any) => ({
                    ...p,
                    name: `${p.name} ${p.surname || ''}`.trim(),
                }));
                const friendData = (friendsRes.data?.data || []).map((p: any) => ({
                    ...p,
                    name: `${p.name} ${p.surname || ''}`.trim(),
                    isFriend: true,
                }));
                setPlayers(playerData);
                setFriends(friendData);
                setScoringMethods(methodsRes.data?.data || []);
            })
            .catch(() => {
                toast('Failed to load data', {theme: 'failure', duration: 3000});
            });
    }, []);

    // Server-side course search — show nothing until the user types
    useEffect(() => {
        const q = courseSearch.trim();
        if (!q) {
            setCourses([]);
            setIsSearchingCourses(false);
            return;
        }
        setIsSearchingCourses(true);
        const handle = setTimeout(() => {
            new HttpService().get(`courses?search=${encodeURIComponent(q)}`)
                .then((res) => setCourses(res.data?.data || []))
                .catch(() => toast('Failed to search courses', {theme: 'failure', duration: 3000}))
                .finally(() => setIsSearchingCourses(false));
        }, 350);
        return () => clearTimeout(handle);
    }, [courseSearch]);

    // When a tournament is resolved, lock its course/tee/scoring straight from the
    // lookup response (no dependency on a preloaded course list).
    useEffect(() => {
        if (!tournament) return;
        if (tournament.course) {
            setSelectedCourse(tournament.course);
            setSelectedCourseTeeId(tournament.tee_id);
        }
        if (tournament.scoring_method) {
            setSelectedScoringMethod(tournament.scoring_method);
        }
    }, [tournament]);

    const handleLookup = () => {
        const code = joinCode.trim();
        if (code.length < 4 || isLookingUp) return;
        setIsLookingUp(true);
        setJoinError('');
        const httpService = new HttpService();
        httpService.get(`tournaments/lookup/${encodeURIComponent(code)}`)
            .then((res) => {
                if (res.data?.success && res.data.data) {
                    setTournament(res.data.data);
                    setCurrentStep(1); // wizard begins at its first step (Players, in join mode)
                } else {
                    setJoinError(res.data?.message || 'No tournament found with that code');
                }
            })
            .catch((err: any) => {
                setJoinError(err.response?.data?.message || 'No tournament found with that code');
            })
            .finally(() => setIsLookingUp(false));
    };

    // When joining a tournament, the course, tee and scoring method are fixed,
    // so those steps drop out of the wizard.
    const isJoining = mode === 'join' && !!tournament;
    const methodId = selectedScoringMethod?.id;
    // Stroke Play (1) & Medal (7) are individual-only → no Format step
    const isStrokeBased = methodId === 1 || methodId === 7;
    // Four Ball (8) & Two Ball (11) Alliance are both one alliance per round with a
    // per-par "scores to count" config. Cap = alliance size (4 or 2 respectively),
    // further clamped to the actual number of players in the round.
    const isFourBallAlliance = methodId === 8;
    const isTwoBallAlliance = methodId === 11;
    const isAlliance = isFourBallAlliance || isTwoBallAlliance;
    const allianceMax = isTwoBallAlliance ? 2 : 4;
    const allianceCap = Math.min(allianceMax, Math.max(1, selectedPlayers.length));
    // Betterball (9) & Worst Ball (10) Stableford are always teams of 1-2 — own team step
    const isBetterball = methodId === 9;
    const isWorstball = methodId === 10;
    const isTeamStableford = isBetterball || isWorstball;
    const steps = [
        ...(isJoining ? [] : ['Course']),
        'Players',
        'Handicap',
        ...(isJoining ? [] : ['Scoring']),
        // Alliance config is fixed by the tournament when joining (skipped); betterball/
        // worstball always need their own team assignment (each round forms its own teams).
        ...(isAlliance ? (isJoining ? [] : ['Alliance'])
            : isTeamStableford ? ['Teams']
            : (isStrokeBased ? [] : ['Format'])),
    ];
    const currentStepLabel = steps[currentStep - 1];
    const lastStep = steps.length;

    // Initialize handicaps when moving to the Handicap step
    useEffect(() => {
        if (currentStepLabel === 'Handicap') {
            setPlayerHandicaps(selectedPlayers.map(player => ({
                ...player,
                roundHandicap: player.handicap
            })));
        }
    }, [currentStepLabel, selectedPlayers]);

    // Reset format when entering the Format step
    useEffect(() => {
        if (currentStepLabel === 'Format') {
            if (selectedPlayers.length === 3) {
                setSelectedFormat('individual');
            }
        }
    }, [currentStepLabel, selectedPlayers.length]);

    // Clamp alliance "scores to count" to the alliance cap (min of the method's max
    // and the player count) when entering that step
    useEffect(() => {
        if (currentStepLabel === 'Alliance') {
            setAllianceCounts(prev => ({
                par3: Math.min(prev.par3, allianceCap),
                par4: Math.min(prev.par4, allianceCap),
                par5: Math.min(prev.par5, allianceCap),
            }));
        }
    }, [currentStepLabel, allianceCap]);

    // Default betterball team assignment when entering the Teams step:
    // pair up (first two → Team 1, next two → Team 2). 2 players default to one pair.
    useEffect(() => {
        if (currentStepLabel === 'Teams') {
            setPlayerAssignments(prev => {
                const next = {...prev};
                let changed = false;
                selectedPlayers.forEach((p, i) => {
                    if (next[p.id] === undefined) {
                        next[p.id] = i < 2 ? 0 : 1;
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
            setTeamNames(prev => [prev[0]?.trim() ? prev[0] : 'Team 1', prev[1]?.trim() ? prev[1] : 'Team 2']);
        }
    }, [currentStepLabel, selectedPlayers]);

    // `courses` already holds the server-side search results (empty until the user types)
    const filteredCourses = courses;

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

    // "You" quick-pick: the logged-in user, shaped like a player row.
    // Pull their "in active round" status from the players list (which carries the flag).
    const currentUserRow = currentUser ? players.find((p: any) => p.id === currentUser.id) : null;
    const currentUserPlayer = currentUser
        ? {
            ...currentUser,
            name: `${currentUser.name} ${currentUser.surname || ''}`.trim(),
            in_active_round: currentUserRow?.in_active_round ?? false,
        }
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

    // Betterball teams: every player assigned, each team 1-2 players, named if used
    const teamCount = (team: 0 | 1) => selectedPlayers.filter(p => playerAssignments[p.id] === team).length;
    const isBetterballValid = () => {
        if (!selectedPlayers.every(p => playerAssignments[p.id] !== undefined)) return false;
        const t0 = teamCount(0), t1 = teamCount(1);
        if (t0 > 2 || t1 > 2 || (t0 === 0 && t1 === 0)) return false;
        if (t0 > 0 && !teamNames[0]?.trim()) return false;
        if (t1 > 0 && !teamNames[1]?.trim()) return false;
        return true;
    };

    // Whether the current step (by label) is complete enough to advance / submit
    const canAdvance = () => {
        switch (currentStepLabel) {
            case 'Course': return isStep1Valid;
            case 'Players': return isStep2Valid;
            case 'Handicap': return isStep3Valid;
            case 'Scoring': return isStep4Valid;
            case 'Format': return isStep5Valid();
            case 'Alliance': return true; // counts are clamped to a valid range
            case 'Teams': return isBetterballValid();
            default: return false;
        }
    };

    const handleCourseSelect = (course) => {
        setSelectedCourse(course);
        setSelectedCourseTeeId(course?.tees?.length === 1 ? course.tees[0].id : null);
    }

    const handlePlayerToggle = (player) => {
        const isSelected = selectedPlayers.some(p => p.id === player.id);
        if (!isSelected && player.in_active_round) {
            toast('This player is already in an active round', {theme: 'failure', duration: 3000});
            return;
        }
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

    const handlePlayerAdded = (newPlayer) => {
        setPlayers([...players, newPlayer]);
        if (selectedPlayers.length < 4) {
            setSelectedPlayers([...selectedPlayers, newPlayer]);
        }
        setShowAddPlayerModal(false);
    }

    const handleNextStep = () => {
        if (currentStep < lastStep && canAdvance()) {
            setCurrentStep(currentStep + 1);
        }
    }

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else if (mode === 'join') {
            // Back from the first wizard step returns to the invite-code screen
            setTournament(null);
            setJoinError('');
        } else {
            setMode('intro');
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

            // Stroke Play, Medal, Alliance → individual; Betterball/Worst Ball → teams
            const effectiveFormat = (isStrokeBased || isAlliance) ? 'individual'
                : isTeamStableford ? 'teams'
                : selectedFormat;

            // Four Ball Alliance config — how many scores count per hole, by par.
            // When joining, use the tournament's locked config; otherwise the local one.
            const scoringConfig = isAlliance
                ? (isJoining
                    ? (tournament?.scoring_config ?? null)
                    : {alliance: {par3: allianceCounts.par3, par4: allianceCounts.par4, par5: allianceCounts.par5}})
                : null;

            let teamsData: { name: string; playerIds: number[] }[] | undefined;
            if (isTeamStableford) {
                // Build from the team assignment; drop empty teams (e.g. a single pair)
                teamsData = ([0, 1] as const)
                    .map(team => ({
                        name: teamNames[team],
                        playerIds: selectedPlayers.filter(p => playerAssignments[p.id] === team).map(p => p.id),
                    }))
                    .filter(t => t.playerIds.length > 0);
            } else if (effectiveFormat === 'teams') {
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
                tournament_id: tournament?.id ?? null,
                scoring_config: scoringConfig,
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

    const checkIcon = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
             strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );


    if (showAddPlayerModal) {
        return (
            <AddPlayerModal
                mode="add"
                onPlayerAdded={handlePlayerAdded}
                onCloseModal={() => setShowAddPlayerModal(false)}
            />
        )
    }

    // --- Intro: choose between a casual round or joining a tournament ---
    if (mode === 'intro') {
        return (
            <div className="modal-container">
                <div className="modal-content round-wizard">
                    <div className="round-wizard__header">
                        <div className="round-wizard__heading">
                            <span className="round-wizard__title">New Round</span>
                            <span className="round-wizard__step">How would you like to start?</span>
                        </div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    <div className="round-intro">
                        <button
                            type="button"
                            className="round-intro__card"
                            onClick={() => { setMode('create'); setCurrentStep(1); }}
                        >
                            <span className="round-intro__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 19V5"/><path d="M12 5l7 2-7 3"/><circle cx="12" cy="20" r="1.5"/>
                                </svg>
                            </span>
                            <span className="round-intro__main">
                                <span className="round-intro__title">Casual Round</span>
                                <span className="round-intro__desc">Pick the course, players and scoring yourself</span>
                            </span>
                            <span className="round-intro__chev">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                     strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                        </button>

                        <button
                            type="button"
                            className="round-intro__card"
                            onClick={() => setMode('join')}
                        >
                            <span className="round-intro__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                                </svg>
                            </span>
                            <span className="round-intro__main">
                                <span className="round-intro__title">Join a Tournament</span>
                                <span className="round-intro__desc">Enter an invite code — course & scoring are set for you</span>
                            </span>
                            <span className="round-intro__chev">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                     strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Join: enter the invite code ---
    if (mode === 'join' && !tournament) {
        return (
            <div className="modal-container">
                <div className="modal-content round-wizard">
                    <div className="round-wizard__header">
                        <div className="round-wizard__heading">
                            <span className="round-wizard__title">Join a Tournament</span>
                            <span className="round-wizard__step">Enter your invite code</span>
                        </div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    <div className="round-join">
                        <span className="round-join__crest">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                                 strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                            </svg>
                        </span>
                        <p className="round-join__hint">Ask the host for the 6-digit code shown on their tournament.</p>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="round-join__code"
                            value={joinCode}
                            maxLength={6}
                            placeholder="000000"
                            autoFocus
                            onChange={(e) => { setJoinCode(e.target.value.replace(/\D/g, '')); setJoinError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
                        />
                        {joinError && <p className="round-join__error">{joinError}</p>}

                        <div className="round-actions">
                            <button
                                type="button"
                                className="round-btn round-btn--ghost"
                                onClick={() => { setMode('intro'); setJoinCode(''); setJoinError(''); }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                                Back
                            </button>
                            <button
                                type="button"
                                className="round-btn round-btn--create"
                                disabled={joinCode.trim().length < 4 || isLookingUp}
                                onClick={handleLookup}
                            >
                                {isLookingUp ? 'Finding…' : 'Find Tournament'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const lockedTeeName = selectedCourse?.tees?.find((t: any) => t.id === selectedCourseTeeId)?.tee_name;

    return (
        <>
            <div className="modal-container">
                <div className="modal-content round-wizard">
                    <div className="round-wizard__header">
                        <div className="round-wizard__heading">
                            <span className="round-wizard__title">{isJoining ? 'Join Tournament' : 'Create Round'}</span>
                            <span className="round-wizard__step">Step {currentStep} of {lastStep} · {currentStepLabel}</span>
                        </div>
                        <button type="button" className="close-button" onClick={onCloseModal}>&times;</button>
                    </div>

                    {isJoining && (
                        <div className="round-tourney-banner">
                            <span className="round-tourney-banner__badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                     strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                                </svg>
                            </span>
                            <div className="round-tourney-banner__text">
                                <span className="round-tourney-banner__name">{tournament.name}</span>
                                <span className="round-tourney-banner__meta">
                                    {[
                                        selectedCourse?.name,
                                        lockedTeeName,
                                        selectedScoringMethod?.name,
                                        (isAlliance && tournament?.scoring_config?.alliance)
                                            ? `best ${tournament.scoring_config.alliance.par3}/${tournament.scoring_config.alliance.par4}/${tournament.scoring_config.alliance.par5}`
                                            : null,
                                    ].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        </div>
                    )}

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

                    {/* Step: Select Course */}
                    {currentStepLabel === 'Course' && (
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
                                {!courseSearch.trim() && (
                                    <div className="no-results">Start typing to find a course</div>
                                )}
                                {courseSearch.trim() && isSearchingCourses && (
                                    <div className="no-results">Searching…</div>
                                )}
                                {courseSearch.trim() && !isSearchingCourses && filteredCourses.length === 0 && (
                                    <div className="no-results">No courses found</div>
                                )}
                            </div>

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
                                                {tee.gender && (
                                                    <span className={`tee-chip__gender tee-chip__gender--${tee.gender.toLowerCase()}`}>{tee.gender}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step: Select Players */}
                    {currentStepLabel === 'Players' && (
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
                                            className={`select-card ${currentUserPlayer.in_active_round ? 'is-busy' : ''}`}
                                            disabled={currentUserPlayer.in_active_round}
                                            onClick={() => handlePlayerToggle(currentUserPlayer)}
                                        >
                                            <span className="player-avatar">{getInitials(currentUserPlayer.name)}</span>
                                            <div className="select-card__main">
                                                <span className="select-card__title">{currentUserPlayer.name}</span>
                                                {currentUserPlayer.phone && <span className="select-card__sub">{currentUserPlayer.phone}</span>}
                                            </div>
                                            {currentUserPlayer.in_active_round
                                                ? <span className="select-card__busy">In a round</span>
                                                : <>
                                                    <span className="round-hcp"><b>{currentUserPlayer.handicap}</b><i>HCP</i></span>
                                                    <span className="select-card__check">{checkIcon}</span>
                                                </>}
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
                                                    className={`select-card ${sel ? 'is-selected' : ''} ${player.in_active_round ? 'is-busy' : ''}`}
                                                    disabled={player.in_active_round}
                                                    onClick={() => handlePlayerToggle(player)}
                                                >
                                                    <span className="player-avatar">{getInitials(player.name)}</span>
                                                    <div className="select-card__main">
                                                        <span className="select-card__title">{player.name}</span>
                                                        {player.phone && <span className="select-card__sub">{player.phone}</span>}
                                                    </div>
                                                    {player.in_active_round
                                                        ? <span className="select-card__busy">In a round</span>
                                                        : <>
                                                            <span className="round-hcp"><b>{player.handicap}</b><i>HCP</i></span>
                                                            <span className="select-card__check">{checkIcon}</span>
                                                        </>}
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
                                                    className={`select-card ${sel ? 'is-selected' : ''} ${player.in_active_round ? 'is-busy' : ''}`}
                                                    disabled={player.in_active_round}
                                                    onClick={() => handlePlayerToggle(player)}
                                                >
                                                    <span className="player-avatar">{getInitials(player.name)}</span>
                                                    <div className="select-card__main">
                                                        <span className="select-card__title">{player.name}</span>
                                                        {player.phone && <span className="select-card__sub">{player.phone}</span>}
                                                    </div>
                                                    {player.in_active_round
                                                        ? <span className="select-card__busy">In a round</span>
                                                        : <>
                                                            <span className="round-hcp"><b>{player.handicap}</b><i>HCP</i></span>
                                                            <span className="select-card__check">{checkIcon}</span>
                                                        </>}
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

                    {/* Step: Confirm Handicaps */}
                    {currentStepLabel === 'Handicap' && (
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

                    {/* Step: Select Scoring Method */}
                    {currentStepLabel === 'Scoring' && (
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

                    {/* Step: Select Format */}
                    {currentStepLabel === 'Format' && (
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

                    {/* Step: Four Ball Alliance config */}
                    {currentStepLabel === 'Alliance' && (
                        <div className="step-content">
                            <p className="step-hint">How many scores should count per hole?</p>
                            <div className="hcp-list">
                                {([['par3', 'Par 3s'], ['par4', 'Par 4s'], ['par5', 'Par 5s']] as const).map(([key, label]) => (
                                    <div key={key} className="hcp-row">
                                        <span className="hcp-row__name">{label}</span>
                                        <div className="hcp-stepper">
                                            <button
                                                type="button"
                                                className="hcp-stepper__btn"
                                                disabled={allianceCounts[key] <= 1}
                                                onClick={() => setAllianceCounts(c => ({...c, [key]: Math.max(1, c[key] - 1)}))}
                                                aria-label={`Fewer scores on ${label}`}
                                            >−</button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="hcp-stepper__value"
                                                value={allianceCounts[key]}
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                className="hcp-stepper__btn"
                                                disabled={allianceCounts[key] >= allianceCap}
                                                onClick={() => setAllianceCounts(c => ({...c, [key]: Math.min(allianceCap, c[key] + 1)}))}
                                                aria-label={`More scores on ${label}`}
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="step-hint" style={{marginTop: 14}}>
                                The best score{allianceCounts.par4 !== 1 ? 's' : ''} from your {allianceCap}-player alliance count toward the team total on each hole.
                            </p>
                        </div>
                    )}

                    {/* Step: Betterball team assignment (teams of 1-2) */}
                    {currentStepLabel === 'Teams' && (
                        <div className="step-content">
                            <p className="step-hint">Pair up into teams — the {isWorstball ? 'worse' : 'better'} Stableford score on each hole counts.</p>
                            <div className="team-setup">
                                {([0, 1] as const).map((team) => {
                                    const full = teamCount(team) >= 2;
                                    return (
                                        <div key={team} className="team-col">
                                            <input
                                                type="text"
                                                className="team-config__input"
                                                value={teamNames[team] || ''}
                                                placeholder={`Team ${team + 1} name`}
                                                onChange={(e) => setTeamNames(team === 0 ? [e.target.value, teamNames[1]] : [teamNames[0], e.target.value])}
                                            />
                                            {selectedPlayers.map(player => {
                                                const inThis = playerAssignments[player.id] === team;
                                                const disabled = !inThis && full;
                                                return (
                                                    <label
                                                        key={player.id}
                                                        className={`team-pick ${inThis ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`bb-${player.id}`}
                                                            checked={inThis}
                                                            disabled={disabled}
                                                            onChange={() => setPlayerAssignments({...playerAssignments, [player.id]: team})}
                                                        />
                                                        <span className="team-pick__avatar">{getInitials(player.name)}</span>
                                                        <span className="team-pick__name">{player.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="round-actions">
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
                        {currentStep < lastStep ? (
                            <button
                                type="button"
                                className="round-btn round-btn--next"
                                disabled={!canAdvance()}
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
                                disabled={!canAdvance()}
                                onClick={handleCreateRound}
                            >
                                {isJoining ? 'Join & Start' : 'Create Round'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default AddRoundModal
