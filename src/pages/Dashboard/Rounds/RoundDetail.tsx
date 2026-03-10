import {useEffect, useState, useMemo} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import LocalDataService from '../../../services/LocalDataService';
import type {Round, HoleScore, PlayerScore} from '../../../services/LocalDataService';
import NumberPicker from '../../../components/NumberPicker';
import '../../../styles/Pages/RoundDetail.scss';

const calculateStablefordPoints = (
    strokes: number,
    par: number,
    strokeIndex: number,
    handicap: number
): number => {
    if (strokes <= 0) return 0;

    // Extra strokes: player gets a stroke on holes where strokeIndex <= handicap
    const extraStrokes = strokeIndex <= handicap ? 1 : 0;
    // For handicaps > 18, player gets 2 strokes on holes where strokeIndex <= (handicap - 18)
    const additionalStroke = handicap > 18 && strokeIndex <= (handicap - 18) ? 1 : 0;

    const adjustedStrokes = strokes - extraStrokes - additionalStroke;
    const diff = adjustedStrokes - par;

    // Points: albatross=5, eagle=4, birdie=3, par=2, bogey=1, double bogey+=0
    if (diff <= -3) return 5;  // Albatross or better
    if (diff === -2) return 4;  // Eagle
    if (diff === -1) return 3;  // Birdie
    if (diff === 0) return 2;   // Par
    if (diff === 1) return 1;   // Bogey
    return 0;                    // Double bogey or worse
};

const RoundDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [round, setRound] = useState<Round | null>(null);
    const [currentHole, setCurrentHole] = useState(1);
    const [currentScores, setCurrentScores] = useState<Record<number, number>>({});

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
            if (existingHoleScore) {
                const scores: Record<number, number> = {};
                existingHoleScore.playerScores.forEach(ps => {
                    scores[ps.playerId] = ps.strokes;
                });
                setCurrentScores(scores);
            } else {
                setCurrentScores({});
            }
        }
    }, [currentHole, round]);

    if (!round) {
        return <div className="round-detail-container">
            <div className="loading">Loading...</div>
        </div>;
    }

    const currentHoleData = round.course.holes.find(h => h.hole_number === currentHole);

    const getPlayerHandicap = (playerId: number): number => {
        const player = round.players.find(p => p.id === playerId);
        return player?.handicap || 0;
    };

    const calculatePlayerPoints = (playerId: number, strokes: number): number => {
        if (!currentHoleData || strokes <= 0) return 0;
        return calculateStablefordPoints(
            strokes,
            currentHoleData.hole_par,
            currentHoleData.hole_stroke,
            getPlayerHandicap(playerId)
        );
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
                    {'Strokes'}
                </div>
                <div className="player-scores">
                    {round.players.map(player => (
                        <div key={player.id} className="score-item">
                            <span className="name">{player.name}</span>
                            <span className="value">{playerTotals[player.id]?.strokes || 0}
                            </span>
                        </div>


                    ))}
                </div>
                <div className="status-title margin-t-20">
                    {'Points'}
                </div>
                <div className="player-scores">
                    {round.players.map(player => (
                        <div key={player.id} className="score-item">
                            <span className="value">{playerTotals[player.id]?.points || 0}</span>

                        </div>


                    ))}
                </div>
            </div>
        );
    };

    const handleScoreChange = (playerId: number, value: number) => {
        setCurrentScores(prev => ({...prev, [playerId]: value}));
    };

    const handleSubmitHole = () => {
        if (!currentHoleData) return;

        const playerScores: PlayerScore[] = round.players.map(player => {
            const strokes = currentScores[player.id] || 0;
            const points = calculateStablefordPoints(
                strokes,
                currentHoleData.hole_par,
                currentHoleData.hole_stroke,
                player.handicap
            );
            return {team_id: null, playerId: player.id, strokes, points};
        });

        const holeScore: HoleScore = {
            holeNumber: currentHole,
            playerScores
        };

        if (round.teams) {
            holeScore.playerScores.forEach((playerScore) => {
                round.teams.forEach((team) => {
                    team.playerIds.forEach((playerId) => {
                        if (playerScore.playerId === playerId) {
                            //We need to assign the team so that we can see what team won
                            playerScore.team_id = team.id;
                        }
                    })
                })
            })
        }


        // Update or add hole score
        const updatedScores = [...round.scores];
        const existingIndex = updatedScores.findIndex(s => s.holeNumber === currentHole);
        if (existingIndex >= 0) {
            updatedScores[existingIndex] = holeScore;
        } else {
            updatedScores.push(holeScore);
        }

        // Auto-advance to next hole
        const nextHole = currentHole === 18 ? 1 : currentHole + 1;

        const updatedRound: Round = {
            ...round,
            scores: updatedScores,
            currentHole: nextHole
        };

        dataService.updateRound(updatedRound);
        setRound(updatedRound);
        setCurrentHole(nextHole);

        // Scroll to top to show updated match status after DOM updates
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 100);
    };

    const handleFinishRound = () => {
        const updatedRound = {...round, completed: true};
        dataService.updateRound(updatedRound);
        navigate('/dashboard/rounds');
    };

    const allHolesScored = round.scores.length === 18;
    const allPlayersHaveScores = round.players.every(p => currentScores[p.id] && currentScores[p.id] > 0);

    const renderScoreInputs = () => {
        if (round.format === 'teams' && round.teams) {
            return round.teams.map(team => (
                <div key={team.id} className="team-group">
                    <h4>{team.name}</h4>
                    {round.players
                        .filter(p => team.playerIds.includes(p.id))
                        .map(player => (
                            <div key={player.id} className="player-score-input">
                                <span className="player-name">{player.name}</span>
                                <span className="player-handicap">HC: {player.handicap}</span>
                                <NumberPicker
                                    value={currentScores[player.id]}
                                    placeholder={currentHoleData?.hole_par}
                                    min={1}
                                    max={15}
                                    onChange={(val) => handleScoreChange(player.id, val)}
                                    label={player.name}
                                />
                                <span className="points-display">
                                    {currentScores[player.id] && currentScores[player.id] > 0
                                        ? `${calculatePlayerPoints(player.id, currentScores[player.id])} pts`
                                        : '-'
                                    }
                                </span>
                            </div>
                        ))
                    }
                </div>
            ));
        }

        return round.players.map(player => (
            <div key={player.id} className="player-score-input">
                <span className="player-name">{player.name}</span>
                <span className="player-handicap">HC: {player.handicap}</span>
                <NumberPicker
                    value={currentScores[player.id]}
                    placeholder={currentHoleData?.hole_par}
                    min={1}
                    max={15}
                    onChange={(val) => handleScoreChange(player.id, val)}
                    label={player.name}
                />
                <span className="points-display">
                    {currentScores[player.id] && currentScores[player.id] > 0
                        ? `${calculatePlayerPoints(player.id, currentScores[player.id])} pts`
                        : '-'
                    }
                </span>
            </div>
        ));
    };

    return (
        <div className="round-detail-container">
            <div/>
            <div className="round-header">
                <button className="back-button" onClick={() => navigate('/dashboard/rounds')}>
                    &larr; Back to Rounds
                </button>
                <div className="round-info">
                    <h2>{round.course.name}</h2>
                    <span className="scoring-method">{round.scoring_method.name}</span>
                    {round.format === 'teams' && <span className="format-badge">Team Format</span>}
                </div>
            </div>

            {renderStatus()}

            <div className="current-hole-section">
                <div className="hole-selector">
                    <button
                        onClick={() => setCurrentHole(currentHole === 1 ? 18 : currentHole - 1)}
                    >
                        &lt;
                    </button>
                    <span>Hole {currentHole}</span>
                    <button
                        onClick={() => setCurrentHole(currentHole === 18 ? 1 : currentHole + 1)}
                    >
                        &gt;
                    </button>
                </div>

                <div className="hole-info">
                    <span>Par: {currentHoleData?.hole_par}</span>
                    <span>Stroke Index: {currentHoleData?.hole_stroke}</span>
                </div>

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
                        Finish Round
                    </button>
                ) : (
                    <button
                        className="button-primary"
                        onClick={handleSubmitHole}
                        disabled={!allPlayersHaveScores}
                    >
                        Submit Hole {currentHole}
                    </button>
                )}
            </div>
        </div>
    );
};

export default RoundDetail;
