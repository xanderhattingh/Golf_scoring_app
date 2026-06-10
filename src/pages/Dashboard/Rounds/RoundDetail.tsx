import {useEffect, useState, useMemo, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import LocalDataService from '../../../services/LocalDataService';
import type {Round, HoleScore, PlayerScore, AnimalType, AnimalEvent} from '../../../services/LocalDataService';
import HttpService from '../../../services/HttpService';
import NumberPicker from '../../../components/NumberPicker';
import '../../../styles/Pages/RoundDetail.scss';
import '../../../styles/Shared/backgrounds.scss';
import golfBg from '../../../assets/golf-bg.jpg';

const calculateStablefordPoints = (
    strokes: number,
    par: number,
    strokeIndex: number,
    handicap: number,
    hasPinkBall: boolean = false
): number => {
    if (strokes <= 0) return 0;

    // Extra strokes: player gets a stroke on holes where strokeIndex <= handicap
    const extraStrokes = strokeIndex <= handicap ? 1 : 0;
    // For handicaps > 18, player gets 2 strokes on holes where strokeIndex <= (handicap - 18)
    const additionalStroke = handicap > 18 && strokeIndex <= (handicap - 18) ? 1 : 0;

    const adjustedStrokes = strokes - extraStrokes - additionalStroke;

    // Calculate points dynamically based on strokes relative to par
    // Formula: 2 points for par, +1 for each stroke under, -1 for each stroke over
    // Double bogey or worse = 0 points
    let points = 0;

    if (adjustedStrokes > par + 2) {
        // Triple bogey or worse = 0 points
        points = 0;
    } else {
        // Calculate points: 2 + (par - adjustedStrokes)
        // Par = 2, Birdie = 3, Eagle = 4, Albatross = 5, Condor = 6, etc.
        // Bogey = 1, Double bogey = 0
        points = 2 + (par - adjustedStrokes);
    }

    // Double points if player has pink ball (Stableford with Pink)
    if (hasPinkBall) {
        points = points * 2;
    }

    return points;
};

const RoundDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [round, setRound] = useState<Round | null>(null);
    const [currentHole, setCurrentHole] = useState(1);
    const [currentScores, setCurrentScores] = useState<Record<number, number>>({});
    const [currentPinkPlayer, setCurrentPinkPlayer] = useState<number | null>(null);
    const [currentAnimalEvents, setCurrentAnimalEvents] = useState<AnimalEvent[]>([]);
    const [isStatusExpanded, setIsStatusExpanded] = useState(false);
    const [showStartingHoleSelector, setShowStartingHoleSelector] = useState(false);
    const [showClearRoundModal, setShowClearRoundModal] = useState(false);

    const dataService = useMemo(() => new LocalDataService(), []);
    const httpService = useMemo(() => new HttpService(), []);

    const syncRound = useCallback(async (roundData: Round, options?: { scores?: HoleScore[]; courseHoles?: boolean }) => {
        const payload: any = {
            current_hole: roundData.currentHole,
            completed: roundData.completed,
        };

        if (options?.scores) {
            payload.scores = options.scores.map(s => ({
                holeNumber: s.holeNumber,
                playerScores: s.playerScores.map(ps => ({
                    playerId: ps.playerId,
                    strokes: ps.strokes,
                    points: ps.points,
                })),
                pinkPlayerId: s.pinkPlayerId || null,
                animalEvents: s.animalEvents?.map(ae => ({
                    playerId: ae.playerId,
                    animalType: ae.animalType,
                })) || [],
            }));
        }

        if (options?.courseHoles) {
            payload.course_holes = roundData.course.holes.map(h => ({
                hole_number: h.hole_number,
                hole_par: h.hole_par,
                hole_stroke: h.hole_stroke,
            }));
        }

        try {
            await httpService.put(`rounds/${roundData.id}`, payload);
        } catch (error: any) {
            console.error('Failed to sync round:', error);
        }
    }, [httpService]);

    // Get the next pink player in rotation for team formats
    // Learns the 4-hole pattern, then repeats it
    const getNextPinkPlayerInRotation = useCallback((roundData: Round | null = round): number | null => {
        if (!roundData?.teams || roundData.teams.length < 2) return null;
        
        // Build flat list of all players in team order
        const allPlayers: number[] = [];
        roundData.teams.forEach(team => {
            allPlayers.push(...team.playerIds);
        });
        
        if (allPlayers.length === 0) return null;
        
        // Find all pink assignments, sorted by time (or hole number as fallback)
        const holesWithPink = roundData.scores
            .filter(s => s.pinkPlayerId != null)
            .sort((a, b) => {
                if (a.pinkAssignedAt && b.pinkAssignedAt) {
                    return new Date(a.pinkAssignedAt).getTime() - new Date(b.pinkAssignedAt).getTime();
                }
                return a.holeNumber - b.holeNumber;
            });
        
        if (holesWithPink.length === 0) {
            return null; // First hole, user must choose
        }
        
        // If we have 4+ holes with pink, we've learned the pattern - just cycle through it
        if (holesWithPink.length >= 4) {
            const learnedOrder = holesWithPink.slice(0, 4).map(h => h.pinkPlayerId!);
            const lastPlayerIndex = learnedOrder.indexOf(holesWithPink[holesWithPink.length - 1].pinkPlayerId!);
            const nextIndex = (lastPlayerIndex + 1) % 4;
            return learnedOrder[nextIndex];
        }
        
        // Less than 4 holes - we're still learning the pattern
        // Get the most recent pink player
        const lastPinkPlayerId = holesWithPink[holesWithPink.length - 1].pinkPlayerId!;
        
        // Find which team the last player was on
        let lastTeamIndex = -1;
        roundData.teams.forEach((team, teamIdx) => {
            if (team.playerIds.includes(lastPinkPlayerId)) {
                lastTeamIndex = teamIdx;
            }
        });
        
        if (lastTeamIndex === -1) {
            return allPlayers[0];
        }
        
        const currentTeam = roundData.teams[lastTeamIndex];
        const teammatesOnTeam = currentTeam.playerIds;
        
        // Count how many from current team have had pink
        const teamPinkCount = holesWithPink.filter(h => 
            teammatesOnTeam.includes(h.pinkPlayerId!)
        ).length;
        
        // If less than 2 from this team have had pink, we need another from this team
        if (teamPinkCount < 2) {
            // Return the other player on this team (the one who hasn't had pink)
            const otherPlayer = teammatesOnTeam.find(pid => pid !== lastPinkPlayerId);
            if (otherPlayer) {
                return otherPlayer;
            }
        }
        
        // Team 1 is done (2 players had pink), move to next team
        const nextTeamIndex = (lastTeamIndex + 1) % roundData.teams.length;
        const nextTeam = roundData.teams[nextTeamIndex];
        
        // Count how many from next team have had pink
        const nextTeamPinkCount = holesWithPink.filter(h => 
            nextTeam.playerIds.includes(h.pinkPlayerId!)
        ).length;
        
        if (nextTeamPinkCount === 0) {
            // First player on next team - user chooses, but suggest first player
            return nextTeam.playerIds[0];
        } else if (nextTeamPinkCount === 1) {
            // Return the other player on next team
            const nextTeamLastPlayer = holesWithPink
                .filter(h => nextTeam.playerIds.includes(h.pinkPlayerId!))
                .pop()?.pinkPlayerId;
            const otherNextTeamPlayer = nextTeam.playerIds.find(pid => pid !== nextTeamLastPlayer);
            return otherNextTeamPlayer || nextTeam.playerIds[0];
        }
        
        // Fallback - shouldn't reach here
        return allPlayers[0];
    }, [round]);

    useEffect(() => {
        if (!round) return;
        if (!Object.keys(currentScores).length) {
            const hole_par = round.course.holes.filter((hole) => {
                return hole.hole_number == currentHole;
            })
            if (hole_par.length) {
                const scores: Record<number, number> = {};
                round.players.forEach((player) => {
                    scores[player.id] = hole_par[0].hole_par;
                })
                setCurrentScores(scores);
            }
        }
    }, [currentHole, currentScores, round])

    useEffect(() => {
        if (id) {
            httpService.get(`rounds/${id}`)
                .then((response) => {
                    const roundData = response.data?.data;
                    if (roundData) {
                        const scoredHoles = new Set(roundData.scores.map((s: HoleScore) => s.holeNumber));
                        let targetHole = roundData.currentHole;
                        if (scoredHoles.has(targetHole) && scoredHoles.size < 18) {
                            for (let h = 1; h <= 18; h++) {
                                if (!scoredHoles.has(h)) {
                                    targetHole = h;
                                    break;
                                }
                            }
                        }
                        setRound(roundData);
                        setCurrentHole(targetHole);
                        const existingHoleScore = roundData.scores.find(
                            (s: HoleScore) => s.holeNumber === targetHole
                        );
                        if (existingHoleScore) {
                            const scores: Record<number, number> = {};
                            existingHoleScore.playerScores.forEach((ps: PlayerScore) => {
                                scores[ps.playerId] = ps.strokes;
                            });
                            setCurrentScores(scores);
                        }
                        if (roundData.scores.length === 0) {
                            setShowStartingHoleSelector(true);
                        }
                        if (targetHole !== roundData.currentHole) {
                            syncRound({ ...roundData, currentHole: targetHole });
                        }
                    }
                })
                .catch(() => {
                    // Fallback to local data if API fails
                    const localData = dataService.getRound(Number(id));
                    if (localData) {
                        setRound(localData);
                        setCurrentHole(localData.currentHole);
                    }
                });
        }
    }, [id, dataService, httpService]);

    const handleStartingHoleSelect = async (holeNumber: 1 | 10) => {
        setCurrentHole(holeNumber);
        setShowStartingHoleSelector(false);
        
        if (round) {
            const updatedRound = {
                ...round,
                currentHole: holeNumber
            };
            setRound(updatedRound);
            await syncRound(updatedRound);
        }
    };

    // Load scores when hole changes
    useEffect(() => {
        if (round) {
            const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);
            const hasAnimalScoring = round.scoring_method.id === 5 || round.scoring_method.id === 6;
            const hasPinkBallScoring = round.scoring_method.id === 4 || round.scoring_method.id === 6;
            
            if (existingHoleScore) {
                const scores: Record<number, number> = {};
                existingHoleScore.playerScores.forEach(ps => {
                    scores[ps.playerId] = ps.strokes;
                });
                setCurrentScores(scores);
                // Load pink player if exists (for Stableford with Pink or Animals and Pink)
                if (hasPinkBallScoring && existingHoleScore.pinkPlayerId) {
                    setCurrentPinkPlayer(existingHoleScore.pinkPlayerId);
                } else {
                    setCurrentPinkPlayer(null);
                }
                // Load animal events if exists
                if (hasAnimalScoring && existingHoleScore.animalEvents) {
                    setCurrentAnimalEvents(existingHoleScore.animalEvents);
                } else {
                    setCurrentAnimalEvents([]);
                }
            } else {
                // New hole - clear scores and animal events
                setCurrentScores({});
                setCurrentAnimalEvents([]);
                
                // Auto-select pink player for new holes (if pink ball scoring)
                if (hasPinkBallScoring && round.format === 'teams' && round.teams) {
                    const nextPinkPlayer = getNextPinkPlayerInRotation(round);
                    setCurrentPinkPlayer(nextPinkPlayer);
                } else {
                    setCurrentPinkPlayer(null);
                }
            }
        }
    }, [currentHole, round, getNextPinkPlayerInRotation]);

    if (!round) {
        return <div className="page-with-background round-detail-page">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content round-detail-container">
                <div className="loading">Loading...</div>
            </div>
        </div>;
    }

    const currentHoleData = round.course.holes.find(h => h.hole_number === currentHole);

    // Check if this is Stableford with Pink scoring method
    const isStablefordPink = round.scoring_method.id === 4;

    // Check if this is an animal scoring method
    const isAnimalScoring = round.scoring_method.id === 5 || round.scoring_method.id === 6;

    // Check if this is Stableford with Animals and Pink
    const isAnimalsAndPink = round.scoring_method.id === 6;

    // Get pink player for current hole
    const getCurrentHolePinkPlayer = (): number | null => {
        const holeScore = round.scores.find(s => s.holeNumber === currentHole);
        return holeScore?.pinkPlayerId || null;
    };

    // Set pink player for current hole
    const handlePinkPlayerChange = async (playerId: number) => {
        setCurrentPinkPlayer(playerId);

        if (currentHoleData) {
            const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);
            if (existingHoleScore) {
                const recalculatedScores = existingHoleScore.playerScores.map(ps => {
                    const hasPinkBall = ps.playerId === playerId;
                    return {
                        ...ps,
                        points: calculateStablefordPoints(
                            ps.strokes,
                            currentHoleData.hole_par,
                            currentHoleData.hole_stroke,
                            getPlayerHandicap(ps.playerId),
                            hasPinkBall
                        )
                    };
                });

                const newHoleScore: HoleScore = {
                    holeNumber: currentHole,
                    playerScores: recalculatedScores,
                    pinkPlayerId: playerId,
                    pinkAssignedAt: new Date().toISOString()
                };

                const newScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
                newScores.push(newHoleScore);

                const updatedRound: Round = {
                    ...round,
                    scores: newScores
                };

                setRound(updatedRound);
                await syncRound(updatedRound, { scores: newScores });
            }
        }
    };

    const getPlayerHandicap = (playerId: number): number => {
        const player = round.players.find(p => p.id === playerId);
        return player?.handicap || 0;
    };

    const calculatePlayerPoints = (playerId: number, strokes: number, forDisplay: boolean = true): number => {
        if (!currentHoleData || strokes <= 0) return 0;
        // When displaying current hole, use selected pink player
        // When calculating for submission, use the stored/current value
        const hasPinkBall = (isStablefordPink || isAnimalsAndPink) && (forDisplay
            ? currentPinkPlayer === playerId
            : getCurrentHolePinkPlayer() === playerId);
        return calculateStablefordPoints(
            strokes,
            currentHoleData.hole_par,
            currentHoleData.hole_stroke,
            getPlayerHandicap(playerId),
            hasPinkBall
        );
    };

    // Animal tracking functions
    const getAnimalEmoji = (animalType: AnimalType): string => {
        switch (animalType) {
            case 'tree':
                return '🌳';
            case 'water':
                return '💧';
            case 'bunker':
                return '🏖️';
            case 'three_putt':
                return '⛳';
        }
    };

    const getAnimalLabel = (animalType: AnimalType): string => {
        switch (animalType) {
            case 'tree':
                return 'Tree';
            case 'water':
                return 'Water';
            case 'bunker':
                return 'Bunker';
            case 'three_putt':
                return '3-Putt';
        }
    };


    const handleAnimalToggle = async (playerId: number, animalType: AnimalType) => {
        if (!isAnimalScoring) return;

        // Check if this player already has this animal on this hole
        const existingEvent = currentAnimalEvents.find(
            e => e.playerId === playerId && e.animalType === animalType
        );

        let updatedEvents: AnimalEvent[];
        if (existingEvent) {
            // Remove the event (toggle off)
            updatedEvents = currentAnimalEvents.filter(e => e !== existingEvent);
        } else {
            // Remove this animal type from any other player on this hole (only one player can have each animal)
            const eventsWithoutThisAnimal = currentAnimalEvents.filter(
                e => !(e.animalType === animalType && e.playerId !== playerId)
            );

            // Add new event
            const newEvent: AnimalEvent = {
                playerId,
                animalType,
                holeNumber: currentHole,
                timestamp: new Date().toISOString()
            };
            updatedEvents = [...eventsWithoutThisAnimal, newEvent];
        }

        setCurrentAnimalEvents(updatedEvents);

        // Update the round with the new animal event and update animal holder
        const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);

        // Update animal holders
        const updatedAnimalHolders = {...round.animalHolders};
        if (!updatedAnimalHolders) {
            updatedAnimalHolders.front9 = {tree: null, water: null, bunker: null, three_putt: null};
            updatedAnimalHolders.back9 = {tree: null, water: null, bunker: null, three_putt: null};
        }

        const isFront9 = currentHole <= 9;
        const nine = isFront9 ? 'front9' : 'back9';

        // If adding event, update the holder
        if (!existingEvent) {
            updatedAnimalHolders[nine] = {
                ...updatedAnimalHolders[nine],
                [animalType]: {playerId, holeNumber: currentHole}
            };
        } else {
            // If removing, need to find the previous holder from earlier holes
            // Look at all holes in this 9, sorted by hole number descending
            const nineHoles = isFront9 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18];
            let previousHolder: { playerId: number; holeNumber: number } | null = null;

            for (const h of nineHoles.slice(0, nineHoles.indexOf(currentHole)).reverse()) {
                const holeScore = round.scores.find(s => s.holeNumber === h);
                if (holeScore?.animalEvents) {
                    const earlierEvent = holeScore.animalEvents
                        .filter(e => e.animalType === animalType)
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    if (earlierEvent) {
                        previousHolder = {playerId: earlierEvent.playerId, holeNumber: earlierEvent.holeNumber};
                        break;
                    }
                }
            }

            updatedAnimalHolders[nine] = {
                ...updatedAnimalHolders[nine],
                [animalType]: previousHolder
            };
        }

        const holeScore: HoleScore = {
            holeNumber: currentHole,
            playerScores: existingHoleScore?.playerScores || [],
            pinkPlayerId: (isStablefordPink || isAnimalsAndPink) ? currentPinkPlayer : null,
            pinkAssignedAt: (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer ? new Date().toISOString() : undefined,
            animalEvents: updatedEvents
        };

        const updatedScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
        updatedScores.push(holeScore);

        const updatedRound: Round = {
            ...round,
            scores: updatedScores,
            animalHolders: updatedAnimalHolders
        };

        setRound(updatedRound);
        await syncRound(updatedRound, { scores: updatedScores });
    };

    const hasAnimalEvent = (playerId: number, animalType: AnimalType): boolean => {
        return currentAnimalEvents.some(e => e.playerId === playerId && e.animalType === animalType);
    };

    const getAnimalHistory = (animalType: AnimalType, isFront9: boolean): AnimalEvent[] => {
        const history: AnimalEvent[] = [];
        const startHole = isFront9 ? 1 : 10;
        const endHole = isFront9 ? 9 : 18;

        for (let h = startHole; h <= endHole; h++) {
            const holeScore = round.scores.find(s => s.holeNumber === h);
            if (holeScore?.animalEvents) {
                holeScore.animalEvents
                    .filter(e => e.animalType === animalType)
                    .forEach(e => history.push(e));
            }
        }

        // Sort by timestamp
        return history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    // Calculate totals for status display
    const calculateTotals = () => {
        const playerTotals: Record<number, { strokes: number; points: number }> = {};
        round.players.forEach(p => {
            playerTotals[p.id] = {strokes: 0, points: 0};
        });

        round.scores.forEach(holeScore => {
            holeScore.playerScores.forEach(ps => {
                if (playerTotals[ps.playerId]) {
                    playerTotals[ps.playerId].strokes += ps.strokes;
                    playerTotals[ps.playerId].points += ps.points;
                }
            });
        });

        return playerTotals;
    };

    // Calculate hole result based on best individual points per team
    const getHoleResult = (holeScore: HoleScore): {
        winner: 'team1' | 'team2' | 'halved';
        team1Best: number;
        team2Best: number
    } => {
        if (!round.teams || round.teams.length < 2) {
            return {winner: 'halved', team1Best: 0, team2Best: 0};
        }

        // Get best (highest) points from each team
        const team1Best = Math.max(
            ...round.teams[0].playerIds.map(pid => {
                const ps = holeScore.playerScores.find(p => p.playerId === pid);
                return ps?.points || 0;
            })
        );
        const team2Best = Math.max(
            ...round.teams[1].playerIds.map(pid => {
                const ps = holeScore.playerScores.find(p => p.playerId === pid);
                return ps?.points || 0;
            })
        );

        if (team1Best > team2Best) return {winner: 'team1', team1Best, team2Best};
        if (team2Best > team1Best) return {winner: 'team2', team1Best, team2Best};
        return {winner: 'halved', team1Best, team2Best};
    };

    const calculateTeamTotals = () => {
        if (!round.teams) return null;

        const playerTotals = calculateTotals();
        const teamTotals: {
            name: string;
            strokes: number;
            points: number;
            holesWon: number;
            holesHalved: number
        }[] = [];

        round.teams.forEach(team => {
            let strokes = 0;
            let points = 0;
            team.playerIds.forEach(pid => {
                strokes += playerTotals[pid]?.strokes || 0;
                points += playerTotals[pid]?.points || 0;
            });

            teamTotals.push({name: team.name, strokes, points, holesWon: 0, holesHalved: 0});
        });

        // Calculate holes won based on best individual points per team
        if (round.teams.length === 2) {
            round.scores.forEach(holeScore => {
                const result = getHoleResult(holeScore);
                if (result.winner === 'team1') {
                    teamTotals[0].holesWon++;
                } else if (result.winner === 'team2') {
                    teamTotals[1].holesWon++;
                } else {
                    teamTotals[0].holesHalved++;
                    teamTotals[1].holesHalved++;
                }
            });
        }

        return teamTotals;
    };

    // Get the previous hole result for display
    const getPreviousHoleResult = (): {
        holeNumber: number;
        winner: string;
        team1Best: number;
        team2Best: number
    } | null => {
        if (!round.teams || round.teams.length < 2 || round.scores.length === 0) return null;

        // Find the most recently scored hole (highest hole number with scores)
        const sortedScores = [...round.scores].sort((a, b) => b.holeNumber - a.holeNumber);
        const lastScoredHole = sortedScores[0];

        const result = getHoleResult(lastScoredHole);
        let winnerName = 'Halved';
        if (result.winner === 'team1') {
            winnerName = round.teams[0].name;
        } else if (result.winner === 'team2') {
            winnerName = round.teams[1].name;
        }

        return {
            holeNumber: lastScoredHole.holeNumber,
            winner: winnerName,
            team1Best: result.team1Best,
            team2Best: result.team2Best
        };
    };

    const renderAnimalStatus = () => {
        if (!isAnimalScoring || !round.animalHolders) return null;

        const isFront9 = currentHole <= 9;
        const nine = isFront9 ? 'front9' : 'back9';
        const nineLabel = isFront9 ? 'Front 9' : 'Back 9';
        const holders = round.animalHolders[nine];

        const animals: AnimalType[] = ['tree', 'water', 'bunker', 'three_putt'];

        return (
            <div className="rd-animals">
                <div className="rd-animals__header">
                    <span className="rd-animals__title">Animals · {nineLabel}</span>
                    {currentHole === 9 && <span className="rd-animals__badge">End of Front 9</span>}
                    {currentHole === 18 && <span className="rd-animals__badge">End of Back 9</span>}
                </div>
                <div className="rd-animals__grid">
                    {animals.map(animalType => {
                        const holder = holders[animalType];
                        const player = holder ? round.players.find(p => p.id === holder.playerId) : null;
                        const history = getAnimalHistory(animalType, isFront9);

                        return (
                            <div key={animalType} className={`rd-animal-card ${holder ? 'has-holder' : ''}`}>
                                <div className="rd-animal-card__icon">{getAnimalEmoji(animalType)}</div>
                                <div className="rd-animal-card__info">
                                    <div className="rd-animal-card__name">{getAnimalLabel(animalType)}</div>
                                    {player ? (
                                        <div className="rd-animal-card__holder">
                                            <span className="rd-animal-card__who">{player.name}</span>
                                            <span className="rd-animal-card__hole">H{holder.holeNumber}</span>
                                        </div>
                                    ) : (
                                        <div className="rd-animal-card__holder is-empty">Nobody yet</div>
                                    )}
                                </div>
                                {history.length > 1 && (
                                    <div className="rd-animal-card__count" title={`${history.length} events this 9`}>
                                        {history.length}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderStatus = () => {
        const playerTotals = calculateTotals();
        const teamTotals = calculateTeamTotals();
        const previousHoleResult = getPreviousHoleResult();

        // Get summary text for collapsed header
        const getStatusSummary = () => {
            if (round.format === 'teams' && teamTotals && round.teams && teamTotals.length === 2) {
                const diff = teamTotals[0].holesWon - teamTotals[1].holesWon;
                if (diff > 0) return `${round.teams[0].name} ${diff}↑`;
                if (diff < 0) return `${round.teams[1].name} ${Math.abs(diff)}↑`;
                return 'All Square';
            }
            return 'Scores';
        };

        const toggleExpand = () => setIsStatusExpanded(!isStatusExpanded);

        const chevron = (
            <svg className="rd-status__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        );

        const secondaryLabel = isStrokePlay ? 'To Par' : 'Pts';
        const scoredPar = round.scores.reduce((sum, hs) =>
            sum + (round.course.holes.find(h => h.hole_number === hs.holeNumber)?.hole_par || 0), 0);
        const fmtToPar = (strokes: number) => {
            const tp = strokes - scoredPar;
            return tp === 0 ? 'E' : tp > 0 ? `+${tp}` : `${tp}`;
        };

        if (round.format === 'teams' && teamTotals && round.teams && teamTotals.length === 2) {
            const diff = teamTotals[0].holesWon - teamTotals[1].holesWon;
            let matchStatusText = 'All Square';
            let matchStatusClass = 'even';

            if (diff > 0) {
                matchStatusText = `${round.teams[0].name} — ${diff} up`;
                matchStatusClass = 'leading';
            } else if (diff < 0) {
                matchStatusText = `${round.teams[1].name} — ${Math.abs(diff)} up`;
                matchStatusClass = 'leading';
            }

            return (
                <div className={`rd-status ${isStatusExpanded ? 'is-open' : ''}`}>
                    <button className="rd-status__toggle" onClick={toggleExpand}>
                        <span className="rd-status__eyebrow">Match Status</span>
                        <span className={`rd-status__summary ${matchStatusClass}`}>{getStatusSummary()}</span>
                        {chevron}
                    </button>

                    <div className="rd-status__body">
                        <div className={`rd-match-banner ${matchStatusClass}`}>{matchStatusText}</div>

                        {previousHoleResult && (
                            <div className="rd-status__prev">
                                <span className="rd-status__prev-label">Hole {previousHoleResult.holeNumber}</span>
                                <span className={`rd-status__prev-val ${previousHoleResult.winner === 'Halved' ? 'halved' : 'won'}`}>
                                    {previousHoleResult.winner === 'Halved'
                                        ? `Halved · ${previousHoleResult.team1Best} pts each`
                                        : `${previousHoleResult.winner} · ${Math.max(previousHoleResult.team1Best, previousHoleResult.team2Best)}–${Math.min(previousHoleResult.team1Best, previousHoleResult.team2Best)}`
                                    }
                                </span>
                            </div>
                        )}

                        <div className="rd-teamscore">
                            {teamTotals.map((team, idx) => (
                                <div key={idx} className="rd-teamscore__col">
                                    <span className="rd-teamscore__name">{team.name}</span>
                                    <span className="rd-teamscore__won">{team.holesWon}</span>
                                    <span className="rd-teamscore__sub">holes won · {team.points} pts</span>
                                </div>
                            ))}
                        </div>

                        <div className="rd-status__title">Players</div>
                        <div className="rd-leaderboard">
                            {round.players.map(player => (
                                <div key={player.id} className="rd-leaderboard__row">
                                    <span className="rd-leaderboard__avatar">{getInitials(player.name)}</span>
                                    <span className="rd-leaderboard__name">{player.name}</span>
                                    <span className="rd-leaderboard__strokes">{playerTotals[player.id]?.strokes || 0}</span>
                                    <span className="rd-leaderboard__secondary">
                                        {isStrokePlay ? fmtToPar(playerTotals[player.id]?.strokes || 0) : (playerTotals[player.id]?.points || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        // Individual format
        return (
            <div className={`rd-status ${isStatusExpanded ? 'is-open' : ''}`}>
                <button className="rd-status__toggle" onClick={toggleExpand}>
                    <span className="rd-status__eyebrow">Leaderboard</span>
                    <span className="rd-status__summary">{round.players.length} players · {round.scores.length}/18</span>
                    {chevron}
                </button>

                <div className="rd-status__body">
                    <div className="rd-leaderboard rd-leaderboard--head">
                        <span className="rd-leaderboard__avatar" />
                        <span className="rd-leaderboard__name">Player</span>
                        <span className="rd-leaderboard__strokes">Strokes</span>
                        <span className="rd-leaderboard__secondary">{secondaryLabel}</span>
                    </div>
                    {round.players.map(player => (
                        <div key={player.id} className="rd-leaderboard__row">
                            <span className="rd-leaderboard__avatar">{getInitials(player.name)}</span>
                            <span className="rd-leaderboard__name">{player.name}</span>
                            <span className="rd-leaderboard__strokes">{playerTotals[player.id]?.strokes || 0}</span>
                            <span className="rd-leaderboard__secondary">
                                {isStrokePlay ? fmtToPar(playerTotals[player.id]?.strokes || 0) : (playerTotals[player.id]?.points || 0)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const handleScoreChange = (playerId: number, value: number) => {
        setCurrentScores(prev => ({...prev, [playerId]: value}));

        // Auto-save when a valid score is entered
        if (value > 0 && currentHoleData) {
            // Use a timeout to batch rapid changes
            setTimeout(() => {
                autoSaveScore(playerId, value);
            }, 300);
        }
    };

    const autoSaveScore = (playerId: number, strokes: number) => {
        if (!currentHoleData) return;

        const hasPinkBall = (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer === playerId;
        const points = calculateStablefordPoints(
            strokes,
            currentHoleData.hole_par,
            currentHoleData.hole_stroke,
            getPlayerHandicap(playerId),
            hasPinkBall
        );

        // Get current hole scores
        const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);
        let updatedPlayerScores: PlayerScore[];

        if (existingHoleScore) {
            // Update existing score for this player, keep others
            updatedPlayerScores = existingHoleScore.playerScores.map(ps =>
                ps.playerId === playerId
                    ? {...ps, strokes, points}
                    : ps
            );

            // Add new player score if not exists
            if (!updatedPlayerScores.find(ps => ps.playerId === playerId)) {
                updatedPlayerScores.push({
                    team_id: null,
                    playerId,
                    strokes,
                    points
                });
            }
        } else {
            // Create new hole score with this player
            updatedPlayerScores = [{
                team_id: null,
                playerId,
                strokes,
                points
            }];
        }

        // Assign team IDs if in team mode
        if (round.teams) {
            updatedPlayerScores.forEach((playerScore) => {
                round.teams!.forEach((team) => {
                    if (team.playerIds.includes(playerScore.playerId)) {
                        playerScore.team_id = team.id;
                    }
                });
            });
        }

        const holeScore: HoleScore = {
            holeNumber: currentHole,
            playerScores: updatedPlayerScores,
            pinkPlayerId: (isStablefordPink || isAnimalsAndPink) ? currentPinkPlayer : null,
            animalEvents: isAnimalScoring ? currentAnimalEvents : undefined
        };

        // Update round
        const updatedScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
        updatedScores.push(holeScore);

        const updatedRound: Round = {
            ...round,
            scores: updatedScores
        };

        setRound(updatedRound);
    };

    // Handle hole data changes (par and stroke index)
    const handleHoleDataChange = async (field: 'hole_par' | 'hole_stroke', value: number) => {
        if (!currentHoleData) return;

        const updatedHoles = round.course.holes.map(h =>
            h.hole_number === currentHole
                ? {...h, [field]: value}
                : h
        );

        const updatedRound: Round = {
            ...round,
            course: {
                ...round.course,
                holes: updatedHoles
            }
        };

        setRound(updatedRound);

        const holeScore = round.scores.find(s => s.holeNumber === currentHole);
        if (holeScore) {
            const recalculatedScores = holeScore.playerScores.map(ps => ({
                ...ps,
                points: calculateStablefordPoints(
                    ps.strokes,
                    field === 'hole_par' ? value : currentHoleData.hole_par,
                    field === 'hole_stroke' ? value : currentHoleData.hole_stroke,
                    getPlayerHandicap(ps.playerId),
                    (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer === ps.playerId
                )
            }));

            const newHoleScore: HoleScore = {
                holeNumber: currentHole,
                playerScores: recalculatedScores,
                pinkPlayerId: (isStablefordPink || isAnimalsAndPink) ? currentPinkPlayer : null
            };

            const newScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
            newScores.push(newHoleScore);

            const finalRound: Round = {
                ...updatedRound,
                scores: newScores
            };

            setRound(finalRound);
            await syncRound(finalRound, { scores: newScores, courseHoles: true });
        } else {
            await syncRound(updatedRound, { courseHoles: true });
        }
    };

    const handleFinishRound = async () => {
        const updatedRound = {...round, completed: true};
        setRound(updatedRound);
        await syncRound(updatedRound, { scores: updatedRound.scores });
        navigate('/dashboard/rounds');
    };

    // Clear all round data (scores)
    const handleClearRound = async () => {
        const updatedRound: Round = {
            ...round,
            scores: [],
            animalHolders: {
                front9: {tree: null, water: null, bunker: null, three_putt: null},
                back9: {tree: null, water: null, bunker: null, three_putt: null}
            },
            currentHole: 1,
            completed: false
        };
        
        setRound(updatedRound);
        setCurrentHole(1);
        setCurrentScores({});
        setCurrentPinkPlayer(null);
        setCurrentAnimalEvents([]);
        setShowClearRoundModal(false);
        setShowStartingHoleSelector(true);

        await syncRound(updatedRound, { scores: [] });
    };

    // Navigate to next hole
    // Save all current hole scores to the round
    const saveCurrentHoleScores = async () => {
        if (!currentHoleData) return;

        let updatedPlayerScores: PlayerScore[] = [];

        round.players.forEach(player => {
            const strokes = currentScores[player.id] || currentHoleData.hole_par;
            if (strokes <= 0) return;

            const hasPinkBall = (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer === player.id;
            const points = calculateStablefordPoints(
                strokes,
                currentHoleData.hole_par,
                currentHoleData.hole_stroke,
                getPlayerHandicap(player.id),
                hasPinkBall
            );

            updatedPlayerScores.push({
                team_id: null,
                playerId: player.id,
                strokes,
                points
            });
        });

        if (round.teams) {
            updatedPlayerScores.forEach((playerScore) => {
                round.teams!.forEach((team) => {
                    if (team.playerIds.includes(playerScore.playerId)) {
                        playerScore.team_id = team.id;
                    }
                });
            });
        }

        const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);

        const holeScore: HoleScore = {
            holeNumber: currentHole,
            playerScores: updatedPlayerScores,
            pinkPlayerId: (isStablefordPink || isAnimalsAndPink) ? currentPinkPlayer : null,
            pinkAssignedAt: (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer ? new Date().toISOString() : undefined,
            animalEvents: isAnimalScoring ? currentAnimalEvents : (existingHoleScore?.animalEvents || [])
        };

        const updatedScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
        updatedScores.push(holeScore);

        const updatedRound: Round = {
            ...round,
            scores: updatedScores
        };

        setRound(updatedRound);
        await syncRound(updatedRound, { scores: updatedScores });
    };

    const handleNextHole = async () => {
        await saveCurrentHoleScores();

        const nextHole = currentHole === 18 ? 1 : currentHole + 1;
        setCurrentHole(nextHole);
        setRound(prev => {
            if (!prev) return prev;
            const updatedRound = {...prev, currentHole: nextHole};
            syncRound(updatedRound);
            return updatedRound;
        });
    };

    const handleNavigateHole = async (newHole: number) => {
        await saveCurrentHoleScores();
        setCurrentHole(newHole);
        setRound(prev => {
            if (!prev) return prev;
            const updatedRound = {...prev, currentHole: newHole};
            syncRound(updatedRound);
            return updatedRound;
        });
    };

    const allHolesScored = round.scores.length === 18;

    const getInitials = (name: string): string =>
        (name || '').split(' ').filter(Boolean).map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase() || '?';

    const isStrokePlay = round.scoring_method.id === 1;

    const renderAnimalToggles = (playerId: number) => {
        if (!isAnimalScoring) return null;

        const animals: AnimalType[] = ['tree', 'water', 'bunker', 'three_putt'];

        return (
            <div className="rd-animal-toggles">
                {animals.map(animalType => {
                    const isActive = hasAnimalEvent(playerId, animalType);
                    return (
                        <button
                            key={animalType}
                            type="button"
                            className={`rd-animal-toggle ${isActive ? 'is-active' : ''}`}
                            onClick={() => handleAnimalToggle(playerId, animalType)}
                            title={getAnimalLabel(animalType)}
                        >
                            <span className="rd-animal-toggle__emoji">{getAnimalEmoji(animalType)}</span>
                            <span className="rd-animal-toggle__label">{getAnimalLabel(animalType)}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderPlayerScoreInput = (player: typeof round.players[0]) => {
        const strokes = currentScores[player.id] || currentHoleData?.hole_par || 0;
        const isDefault = !currentScores[player.id];
        const isPink = (isStablefordPink || isAnimalsAndPink) && currentPinkPlayer === player.id;
        const par = currentHoleData?.hole_par || 0;
        const toPar = strokes - par;
        const toParLabel = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`;
        const toParClass = toPar < 0 ? 'under' : toPar > 0 ? 'over' : 'even';
        const points = calculatePlayerPoints(player.id, strokes, true);

        return (
            <div key={player.id} className={`rd-player ${isPink ? 'rd-player--pink' : ''}`}>
                <div className="rd-player__head">
                    <span className="rd-player__avatar">{getInitials(player.name)}</span>
                    <div className="rd-player__id">
                        <span className="rd-player__name">{player.name}</span>
                        <span className="rd-player__hcp">HCP {player.handicap}</span>
                    </div>
                    {isPink && <span className="rd-player__pink">2× Pink</span>}
                </div>

                {renderAnimalToggles(player.id)}

                <div className="rd-player__score">
                    <NumberPicker
                        value={currentScores[player.id]}
                        placeholder={currentHoleData?.hole_par}
                        min={1}
                        max={15}
                        onChange={(val) => handleScoreChange(player.id, val)}
                        label={player.name}
                    />
                    {isStrokePlay ? (
                        <div className={`rd-stat rd-stat--topar ${toParClass}`}>
                            <span className="rd-stat__num">{strokes > 0 ? toParLabel : '–'}</span>
                            <span className="rd-stat__lbl">To Par</span>
                        </div>
                    ) : (
                        <div className="rd-stat">
                            <span className={`rd-stat__num ${isDefault ? 'is-default' : ''}`}>{points}</span>
                            <span className="rd-stat__lbl">{isPink ? 'Pts ×2' : 'Points'}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderScoreInputs = () => {
        if (round.format === 'teams' && round.teams) {
            return (
                <div className="rd-teams">
                    {round.teams.map((team, idx) => (
                        <div key={team.id} className={`rd-team rd-team--${idx === 0 ? 'one' : 'two'}`}>
                            <div className="rd-team__header">
                                <span className="rd-team__dot" />
                                <h4>{team.name}</h4>
                            </div>
                            <div className="rd-players">
                                {round.players
                                    .filter(p => team.playerIds.includes(p.id))
                                    .map(player => renderPlayerScoreInput(player))
                                }
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="rd-players">
                {round.players.map(player => renderPlayerScoreInput(player))}
            </div>
        );
    };

    return (
        <div className="page-with-background round-detail-page">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content round-detail-container">
                {/* Starting Hole Selector Modal */}
                {showStartingHoleSelector && (
                    <div className="modal-overlay starting-hole-modal">
                        <div className="modal">
                            <div className="modal-header">
                                <h2>🏌️ Select Starting Hole</h2>
                                <p className="modal-subtitle">Where are you teeing off?</p>
                            </div>
                            <div className="modal-body">
                                <div className="starting-hole-options">
                                    <button 
                                        className="starting-hole-btn front-9"
                                        onClick={() => handleStartingHoleSelect(1)}
                                    >
                                        <span className="hole-number">1</span>
                                        <span className="hole-label">Front 9</span>
                                        <span className="hole-range">Holes 1-9</span>
                                    </button>
                                    <button 
                                        className="starting-hole-btn back-9"
                                        onClick={() => handleStartingHoleSelect(10)}
                                    >
                                        <span className="hole-number">10</span>
                                        <span className="hole-label">Back 9</span>
                                        <span className="hole-range">Holes 10-18</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clear Round Confirmation Modal */}
                {showClearRoundModal && (
                    <div className="modal-overlay">
                        <div className="modal confirm-modal">
                            <div className="modal-header">
                                <h2>🗑️ Clear Round Data</h2>
                            </div>
                            <div className="modal-body">
                                <p>Are you sure you want to clear all scores for this round?</p>
                                <p className="warning-text">This will delete all hole scores and cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button className="button-secondary" onClick={() => setShowClearRoundModal(false)}>
                                    Cancel
                                </button>
                                <button className="button-danger" onClick={handleClearRound}>
                                    Clear All Scores
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="rd-topbar">
                    <button className="rd-back" onClick={() => navigate('/dashboard/rounds')} title="Back to rounds">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <div className="rd-topbar__title">
                        <h2>{round.course.name}</h2>
                        <div className="rd-topbar__badges">
                            <span className="rd-method">{round.scoring_method.name}</span>
                            {round.format === 'teams' && <span className="rd-format">Teams</span>}
                        </div>
                    </div>
                    {round.scores.length > 0 && (
                        <button
                            className="rd-clear"
                            onClick={() => setShowClearRoundModal(true)}
                            title="Clear all scores"
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    )}
                </div>

                {renderStatus()}

                <div className="rd-hole">
                    <button
                        className="rd-hole__nav"
                        onClick={() => handleNavigateHole(currentHole === 1 ? 18 : currentHole - 1)}
                        aria-label="Previous hole"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <div className="rd-hole__center">
                        <span className="rd-hole__label">Hole</span>
                        <span className="rd-hole__num">{currentHole}</span>
                        <div className="rd-hole__meta">
                            <div className="rd-hole__meta-item">
                                <span className="rd-hole__meta-label">Par</span>
                                <NumberPicker
                                    value={currentHoleData?.hole_par}
                                    placeholder={4}
                                    min={3}
                                    max={5}
                                    onChange={(value) => handleHoleDataChange('hole_par', value)}
                                    title="Select Par"
                                />
                            </div>
                            <div className="rd-hole__meta-item">
                                <span className="rd-hole__meta-label">SI</span>
                                <NumberPicker
                                    value={currentHoleData?.hole_stroke}
                                    placeholder={1}
                                    min={1}
                                    max={18}
                                    onChange={(value) => handleHoleDataChange('hole_stroke', value)}
                                    title="Select Stroke Index"
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        className="rd-hole__nav"
                        onClick={() => handleNavigateHole(currentHole === 18 ? 1 : currentHole + 1)}
                        aria-label="Next hole"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>

                {(isStablefordPink || isAnimalsAndPink) && (
                    <div className="rd-pink">
                        <div className="rd-pink__label">
                            <span className="rd-pink__dot" /> Pink Ball — double points
                        </div>
                        <div className="rd-pink__players">
                            {round.players.map(player => (
                                <button
                                    key={player.id}
                                    type="button"
                                    className={`rd-pink__btn ${currentPinkPlayer === player.id ? 'is-selected' : ''}`}
                                    onClick={() => handlePinkPlayerChange(player.id)}
                                >
                                    {player.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {renderAnimalStatus()}

                <div className="rd-scores">
                    {renderScoreInputs()}
                </div>

                <div className="rd-actionbar">
                    {allHolesScored && !round.completed ? (
                        <button className="rd-finish" onClick={handleFinishRound}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Finish Round
                        </button>
                    ) : (
                        <button className="rd-next" onClick={handleNextHole}>
                            Next Hole
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoundDetail;
