import {useEffect, useState, useMemo} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import LocalDataService from '../../../services/LocalDataService';
import type {Round, HoleScore, PlayerScore, AnimalType, AnimalEvent} from '../../../services/LocalDataService';
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

    const dataService = useMemo(() => new LocalDataService(), []);

    useEffect(() => {
        const roundData = dataService.getRound(Number(id));
        if (!Object.keys(currentScores).length) {
            const hole_par = roundData.course.holes.filter((hole) => {
                return hole.hole_number == currentHole;
            })
            if (hole_par) {
                const scores: Record<number, number> = {};
                roundData.players.forEach((player) => {
                    scores[player.id] = hole_par[0].hole_par;
                })
                setCurrentScores(scores);
            }
        }
    }, [currentHole, currentScores])

    useEffect(() => {
        if (id) {
            const roundData = dataService.getRound(Number(id));
            if (roundData) {
                setRound(roundData);
                setCurrentHole(roundData.currentHole);
                // Load existing scores for current hole if any
                const existingHoleScore = roundData.scores.find(
                    s => s.holeNumber === roundData.currentHole
                );
                if (existingHoleScore) {
                    const scores: Record<number, number> = {};
                    existingHoleScore.playerScores.forEach(ps => {
                        scores[ps.playerId] = ps.strokes;
                    });
                    setCurrentScores(scores);
                }
            }
        }
    }, [id, dataService]);

    // Load scores when hole changes
    useEffect(() => {
        if (round) {
            const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);
            const hasAnimalScoring = round.scoring_method.id === 5 || round.scoring_method.id === 6;
            if (existingHoleScore) {
                const scores: Record<number, number> = {};
                existingHoleScore.playerScores.forEach(ps => {
                    scores[ps.playerId] = ps.strokes;
                });
                setCurrentScores(scores);
                // Load pink player if exists (for Stableford with Pink or Animals and Pink)
                if ((round.scoring_method.id === 4 || round.scoring_method.id === 6) && existingHoleScore.pinkPlayerId) {
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
                setCurrentScores({});
                setCurrentPinkPlayer(null);
                setCurrentAnimalEvents([]);
            }
        }
    }, [currentHole, round]);

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

    // Get scoring method class name for styling
    const getScoringMethodClass = (): string => {
        switch (round.scoring_method.id) {
            case 1:
                return 'scoring-stroke-play';
            case 2:
                return 'scoring-stableford';
            case 3:
                return 'scoring-match-play';
            case 4:
                return 'scoring-stableford-pink';
            case 5:
                return 'scoring-animals';
            case 6:
                return 'scoring-animals-pink';
            default:
                return 'scoring-default';
        }
    };

    // Get pink player for current hole
    const getCurrentHolePinkPlayer = (): number | null => {
        const holeScore = round.scores.find(s => s.holeNumber === currentHole);
        return holeScore?.pinkPlayerId || null;
    };

    // Set pink player for current hole
    const handlePinkPlayerChange = (playerId: number) => {
        setCurrentPinkPlayer(playerId);

        // Recalculate points for all players on this hole when pink player changes
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
                    pinkPlayerId: playerId
                };

                const newScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
                newScores.push(newHoleScore);

                const updatedRound: Round = {
                    ...round,
                    scores: newScores
                };

                dataService.updateRound(updatedRound);
                setRound(updatedRound);
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


    const handleAnimalToggle = (playerId: number, animalType: AnimalType) => {
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
            animalEvents: updatedEvents
        };

        const updatedScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
        updatedScores.push(holeScore);

        const updatedRound: Round = {
            ...round,
            scores: updatedScores,
            animalHolders: updatedAnimalHolders
        };

        dataService.updateRound(updatedRound);
        setRound(updatedRound);
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
            <div className="animal-status-section">
                <div className="animal-status-header">
                    <span className="status-title">🦁 Animals ({nineLabel})</span>
                    {currentHole === 9 && (
                        <span className="nine-complete-badge">End of Front 9</span>
                    )}
                    {currentHole === 18 && (
                        <span className="nine-complete-badge">End of Back 9</span>
                    )}
                </div>
                <div className="animal-holders-grid">
                    {animals.map(animalType => {
                        const holder = holders[animalType];
                        const player = holder ? round.players.find(p => p.id === holder.playerId) : null;
                        const history = getAnimalHistory(animalType, isFront9);

                        return (
                            <div key={animalType} className={`animal-holder-card ${holder ? 'has-holder' : ''}`}>
                                <div className="animal-icon">{getAnimalEmoji(animalType)}</div>
                                <div className="animal-info">
                                    <div className="animal-name">{getAnimalLabel(animalType)}</div>
                                    {player ? (
                                        <div className="animal-holder">
                                            <span className="holder-name">{player.name}</span>
                                            <span className="holder-hole">H{holder.holeNumber}</span>
                                        </div>
                                    ) : (
                                        <div className="animal-holder empty">-</div>
                                    )}
                                </div>
                                {history.length > 1 && (
                                    <div className="animal-history-count" title={`${history.length} events this 9`}>
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

        if (round.format === 'teams' && teamTotals && round.teams && teamTotals.length === 2) {
            const diff = teamTotals[0].holesWon - teamTotals[1].holesWon;
            let matchStatusText = 'All Square';
            let matchStatusClass = '';

            if (diff > 0) {
                matchStatusText = `${round.teams[0].name} - ${diff} up`;
                matchStatusClass = 'leading';
            } else if (diff < 0) {
                matchStatusText = `${round.teams[1].name} - ${Math.abs(diff)} up`;
                matchStatusClass = 'leading';
            }

            return (
                <div className="status-section">
                    <div className="match-status">
                        <div className="status-title">Match Status</div>
                        <div className={`status-value ${matchStatusClass}`}>{matchStatusText}</div>
                    </div>

                    {previousHoleResult && (
                        <div className="previous-hole-result">
                            <div className="result-title">Hole {previousHoleResult.holeNumber} Result</div>
                            <div
                                className={`result-value ${previousHoleResult.winner === 'Halved' ? 'halved' : 'won'}`}>
                                {previousHoleResult.winner === 'Halved'
                                    ? `Halved (${previousHoleResult.team1Best} pts each)`
                                    : `${previousHoleResult.winner} won (${Math.max(previousHoleResult.team1Best, previousHoleResult.team2Best)} vs ${Math.min(previousHoleResult.team1Best, previousHoleResult.team2Best)} pts)`
                                }
                            </div>
                        </div>
                    )}

                    <div className="holes-summary">
                        <div className="team-holes">
                            <span className="team-name">{round.teams[0].name}</span>
                            <span className="holes-won">{teamTotals[0].holesWon} won</span>
                        </div>
                        <div className="halved-holes">
                            <span>{teamTotals[0].holesHalved} halved</span>
                        </div>
                        <div className="team-holes">
                            <span className="team-name">{round.teams[1].name}</span>
                            <span className="holes-won">{teamTotals[1].holesWon} won</span>
                        </div>
                    </div>

                    <div className="team-points-totals">
                        <div className="status-title">Total Points</div>
                        <div className="team-scores">
                            {teamTotals.map((team, idx) => (
                                <div key={idx} className="score-item">
                                    <span className="name">{team.name}</span>
                                    <span className="value">{team.points}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="status-title">
                        {round.scoring_method.id === 2 ? 'Points' : 'Strokes'}
                    </div>
                    <div className="player-scores">
                        {round.players.map(player => (
                            <div key={player.id} className="score-item">
                                <span className="name">{player.name}</span>
                                <span className="value">
                                        {playerTotals[player.id]?.strokes}
                            </span>
                            </div>
                        ))}
                    </div>

                </div>

            );
        }

        // Individual format
        return (
            <div className="status-section">
                <div className="status-title">
                    {'Strokes/Points'}
                </div>
                <div className="player-scores">
                    {round.players.map(player => (
                        <div key={player.id} className="score-item">
                            <span className="name">{player.name}</span>
                            <span
                                className="value">{playerTotals[player.id]?.strokes || 0}/{playerTotals[player.id]?.points || 0}
                            </span>
                            <span className="value"></span>
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

        dataService.updateRound(updatedRound);
        setRound(updatedRound);
    };

    // Handle hole data changes (par and stroke index)
    const handleHoleDataChange = (field: 'hole_par' | 'hole_stroke', value: number) => {
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

        dataService.updateRound(updatedRound);
        setRound(updatedRound);

        // Recalculate points for this hole if scores exist
        const holeScore = round.scores.find(s => s.holeNumber === currentHole);
        if (holeScore) {
            const recalculatedScores = holeScore.playerScores.map(ps => ({
                ...ps,
                points: calculateStablefordPoints(
                    ps.strokes,
                    field === 'hole_par' ? value : currentHoleData.hole_par,
                    field === 'hole_stroke' ? value : currentHoleData.hole_stroke,
                    getPlayerHandicap(ps.playerId),
                    isStablefordPink && currentPinkPlayer === ps.playerId
                )
            }));

            const newHoleScore: HoleScore = {
                holeNumber: currentHole,
                playerScores: recalculatedScores,
                pinkPlayerId: isStablefordPink ? currentPinkPlayer : null
            };

            const newScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
            newScores.push(newHoleScore);

            const finalRound: Round = {
                ...updatedRound,
                scores: newScores
            };

            dataService.updateRound(finalRound);
            setRound(finalRound);
        }
    };

    const handleFinishRound = () => {
        const updatedRound = {...round, completed: true};
        dataService.updateRound(updatedRound);
        navigate('/dashboard/rounds');
    };

    // Navigate to next hole
    // Save all current hole scores to the round
    const saveCurrentHoleScores = () => {
        if (!currentHoleData) return;

        let updatedPlayerScores: PlayerScore[] = [];

        // Save ALL players - use their entered score or default to par
        round.players.forEach(player => {
            // Use entered score if available, otherwise use par as default
            const strokes = currentScores[player.id] || currentHoleData.hole_par;
            if (strokes <= 0) return;

            const hasPinkBall = isStablefordPink && currentPinkPlayer === player.id;
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

        const existingHoleScore = round.scores.find(s => s.holeNumber === currentHole);

        const holeScore: HoleScore = {
            holeNumber: currentHole,
            playerScores: updatedPlayerScores,
            pinkPlayerId: (isStablefordPink || isAnimalsAndPink) ? currentPinkPlayer : null,
            animalEvents: isAnimalScoring ? (existingHoleScore?.animalEvents || []) : undefined
        };

        // Update round
        const updatedScores = [...round.scores.filter(s => s.holeNumber !== currentHole)];
        updatedScores.push(holeScore);

        const updatedRound: Round = {
            ...round,
            scores: updatedScores
        };

        dataService.updateRound(updatedRound);
        setRound(updatedRound);
    };

    const handleNextHole = () => {
        // Save all current scores before navigating
        saveCurrentHoleScores();

        const nextHole = currentHole === 18 ? 1 : currentHole + 1;
        setCurrentHole(nextHole);
    };

    const handleNavigateHole = (newHole: number) => {
        // Save all current scores before navigating
        saveCurrentHoleScores();
        setCurrentHole(newHole);
    };

    const allHolesScored = round.scores.length === 18;

    const renderAnimalToggles = (playerId: number) => {
        if (!isAnimalScoring) return null;

        const animals: AnimalType[] = ['tree', 'water', 'bunker', 'three_putt'];

        return (
            <div className="animal-toggles">
                {animals.map(animalType => {
                    const isActive = hasAnimalEvent(playerId, animalType);
                    return (
                        <button
                            key={animalType}
                            type="button"
                            className={`animal-toggle-btn ${isActive ? 'active' : ''}`}
                            onClick={() => handleAnimalToggle(playerId, animalType)}
                            title={getAnimalLabel(animalType)}
                        >
                            <span className="animal-emoji">{getAnimalEmoji(animalType)}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderScoreInputs = () => {
        if (round.format === 'teams' && round.teams) {
            return round.teams.map(team => (
                <div key={team.id} className="team-group">
                    <div className="team-header">
                        <span className="team-flag">{team.id === 1 ? '🔴' : '🔵'}</span>
                        <h4>{team.name}</h4>
                    </div>
                    {round.players
                        .filter(p => team.playerIds.includes(p.id))
                        .map(player => (
                            <div key={player.id} className={`player-score-input ${getScoringMethodClass()}`}>
                                <div className="player-info">
                                    <span className="player-name">{player.name}</span>
                                    <span className="player-handicap">HCP {player.handicap}</span>
                                </div>
                                {renderAnimalToggles(player.id)}
                                <div className="score-row">
                                    <NumberPicker
                                        value={currentScores[player.id]}
                                        placeholder={currentHoleData?.hole_par}
                                        min={1}
                                        max={15}
                                        onChange={(val) => handleScoreChange(player.id, val)}
                                        label={player.name}
                                    />
                                    <div className="points-display">
                                        {(() => {
                                            const strokes = currentScores[player.id] || currentHoleData?.hole_par || 0;
                                            const isDefault = !currentScores[player.id];
                                            return (
                                                <>
                                                <span className={isDefault ? 'points-default' : ''}>
                                                    {calculatePlayerPoints(player.id, strokes, true)}
                                                </span>
                                                    {(isStablefordPink || isAnimalsAndPink) && currentPinkPlayer === player.id && (
                                                        <span className="points-multiplier">2x</span>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                            </div>
                        ))
                    }
                </div>
            ));
        }

        return round.players.map(player => (
            <div key={player.id} className={`player-score-input ${getScoringMethodClass()}`}>
                <div className="player-info-row">
                    <span className="player-name">{player.name}</span>
                    <span className="player-handicap">HC: {player.handicap}</span>
                </div>
                {renderAnimalToggles(player.id)}
                <div className="score-row">
                    <NumberPicker
                        value={currentScores[player.id]}
                        placeholder={currentHoleData?.hole_par}
                        min={1}
                        max={15}
                        onChange={(val) => handleScoreChange(player.id, val)}
                        label={player.name}
                    />
                    <span className="points-display">
                        {(() => {
                            const strokes = currentScores[player.id] || currentHoleData?.hole_par || 0;
                            const isDefault = !currentScores[player.id];
                            return (
                                <span className={isDefault ? 'points-default' : ''}>
                                    {calculatePlayerPoints(player.id, strokes)} pts
                                </span>
                            );
                        })()}
                    </span>
                </div>
            </div>
        ));
    };

    return (
        <div className="page-with-background round-detail-page">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content round-detail-container">
                <div className="round-header">
                    <button className="back-button" onClick={() => navigate('/dashboard/rounds')}>
                        &larr; Back to Rounds
                    </button>
                    <div className="round-info">
                        <h2>⛳ {round.course.name}</h2>
                        <div className="meta-badges">
                            <span className="scoring-method">{round.scoring_method.name}</span>
                            {round.format === 'teams' && <span className="format-badge">Team Format</span>}
                        </div>
                    </div>
                </div>

                {renderAnimalStatus()}
                {renderStatus()}

                <div className="current-hole-section">
                    <div className="hole-selector">
                        <button
                            onClick={() => handleNavigateHole(currentHole === 1 ? 18 : currentHole - 1)}
                        >
                            &lt;
                        </button>
                        <span>Hole {currentHole}</span>
                        <button
                            onClick={() => handleNavigateHole(currentHole === 18 ? 1 : currentHole + 1)}
                        >
                            &gt;
                        </button>
                    </div>

                    <div className="hole-info editable">
                        <div className="info-badge par editable">
                            <span className="label">Par</span>
                            <NumberPicker
                                value={currentHoleData?.hole_par}
                                placeholder={4}
                                min={3}
                                max={5}
                                onChange={(value) => handleHoleDataChange('hole_par', value)}
                                title="Select Par"
                            />
                        </div>
                        <div className="info-badge stroke-index editable">
                            <span className="label">Stroke Index</span>
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

                    {(isStablefordPink || isAnimalsAndPink) && (
                        <div className="pink-ball-section">
                            <label className="pink-ball-label">Pink Ball (Double Points):</label>
                            <div className="pink-ball-players">
                                {round.players.map(player => (
                                    <button
                                        key={player.id}
                                        type="button"
                                        className={`pink-ball-btn ${currentPinkPlayer === player.id ? 'selected' : ''}`}
                                        onClick={() => handlePinkPlayerChange(player.id)}
                                    >
                                        {player.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="score-inputs">
                        {renderScoreInputs()}
                    </div>

                </div>

                {/* Fixed bottom action bar for easy thumb access */}
                <div className="fixed-action-bar">
                    {allHolesScored && !round.completed ? (
                        <button
                            className="button-primary finish-button"
                            onClick={handleFinishRound}
                        >
                            ✅ Finish Round
                        </button>
                    ) : (
                        <button
                            className="button-secondary"
                            onClick={handleNextHole}
                        >
                            Next Hole →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoundDetail;
