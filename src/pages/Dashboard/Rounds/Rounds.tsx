import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import LocalDataService from "../../../services/LocalDataService.ts";
import type {Round} from "../../../services/LocalDataService.ts";

import "../../../styles/Pages/Rounds.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddRoundModal from "../../../components/AddRoundModal.tsx";
import golfBg from "../../../assets/golf-bg-4.jpg";

const Rounds = () => {
    const navigate = useNavigate();
    const [rounds, setRounds] = useState([]);
    const [showRoundModal, setShowRoundModal] = useState(false);
    const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);

    useEffect(() => {
        const dataService = new LocalDataService();
        setRounds(dataService.getRounds());
    }, []);

    const handleAddRoundClick = () => {
        setShowRoundModal(true);
    }

    const handleCloseModalClick = () => {
        setShowRoundModal(false);
    }

    const handleRoundCreated = ($event) => {
        setRounds((old) => [...old, $event]);
        setShowRoundModal(false);
        navigate(`/round/${$event.id}`);
    }

    const handleViewRoundClick = (round) => {
        navigate(`/round/${round.id}`);
    }

    const handleEditRoundClick = (round) => {
        navigate(`/round/${round.id}`);
    }

    const handleDeleteClick = (round: Round) => {
        setRoundToDelete(round);
    }

    const handleConfirmDelete = () => {
        if (roundToDelete) {
            const dataService = new LocalDataService();
            dataService.deleteRound(roundToDelete.id);
            setRounds((old) => old.filter((r) => r.id !== roundToDelete.id));
            setRoundToDelete(null);
        }
    }

    const handleCancelDelete = () => {
        setRoundToDelete(null);
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const handleExportRound = (round: Round) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Golf Scorecard', pageWidth / 2, 20, {align: 'center'});

        // Round info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Course: ${round.course.name}`, 14, 35);
        doc.text(`Date: ${formatDate(round.date)}`, 14, 42);
        doc.text(`Format: ${round.format === 'teams' ? 'Teams' : 'Individual'}`, 14, 49);
        doc.text(`Scoring: ${round.scoring_method.name}`, 14, 56);

        // Players
        const playerNames = round.players.map(p => `${p.name} (HC: ${p.handicap})`).join(', ');
        doc.text(`Players: ${playerNames}`, 14, 63);

        // Teams (if applicable)
        if (round.format === 'teams' && round.teams) {
            const teamInfo = round.teams.map(t => {
                const members = t.playerIds.map(pid => round.players.find(p => p.id === pid)?.name).join(' & ');
                return `${t.name}: ${members}`;
            }).join(' | ');
            doc.text(`Teams: ${teamInfo}`, 14, 70);
        }

        // Calculate player totals
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

        // Summary table
        const summaryStartY = round.format === 'teams' ? 80 : 73;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, summaryStartY);

        const summaryHeaders = ['Player', 'Handicap', 'Total Strokes', 'Total Points'];
        const summaryData = round.players.map(p => [
            p.name,
            p.handicap.toString(),
            playerTotals[p.id].strokes.toString(),
            playerTotals[p.id].points.toString()
        ]);

        autoTable(doc, {
            startY: summaryStartY + 5,
            head: [summaryHeaders],
            body: summaryData,
            theme: 'striped',
            headStyles: {fillColor: [59, 130, 246]},
            margin: {left: 14, right: 14}
        });

        // Helper to get hole winner for team matches
        const getHoleWinner = (holeNumber: number): { winner: string; team1Best: number; team2Best: number } => {
            if (!round.teams || round.teams.length < 2) {
                return {winner: '-', team1Best: 0, team2Best: 0};
            }
            const holeScore = round.scores.find(s => s.holeNumber === holeNumber);
            if (!holeScore) return {winner: '-', team1Best: 0, team2Best: 0};

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

            if (team1Best > team2Best) return {winner: round.teams[0].name, team1Best, team2Best};
            if (team2Best > team1Best) return {winner: round.teams[1].name, team1Best, team2Best};
            return {winner: 'Halved', team1Best, team2Best};
        };

        // Team Match Results (if team format)
        // @ts-expect-error autoTable adds lastAutoTable to doc
        let scorecardStartY = doc.lastAutoTable.finalY + 15;

        if (round.format === 'teams' && round.teams && round.teams.length === 2) {
            // Calculate team results
            let team1Wins = 0;
            let team2Wins = 0;
            let halved = 0;

            for (let h = 1; h <= 18; h++) {
                const result = getHoleWinner(h);
                if (result.winner === round.teams[0].name) team1Wins++;
                else if (result.winner === round.teams[1].name) team2Wins++;
                else if (result.winner === 'Halved') halved++;
            }

            const diff = team1Wins - team2Wins;
            let matchResult = 'All Square';
            if (diff > 0) {
                matchResult = `${round.teams[0].name} wins ${diff} up`;
            } else if (diff < 0) {
                matchResult = `${round.teams[1].name} wins ${Math.abs(diff)} up`;
            }

            // @ts-expect-error autoTable adds lastAutoTable to doc
            const teamResultsY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Match Result', 14, teamResultsY);

            autoTable(doc, {
                startY: teamResultsY + 5,
                head: [['Team', 'Holes Won', 'Holes Halved', 'Result']],
                body: [
                    [round.teams[0].name, team1Wins.toString(), halved.toString(), diff > 0 ? 'WINNER' : (diff === 0 ? 'DRAW' : '')],
                    [round.teams[1].name, team2Wins.toString(), halved.toString(), diff < 0 ? 'WINNER' : (diff === 0 ? 'DRAW' : '')]
                ],
                theme: 'striped',
                headStyles: {fillColor: [16, 185, 129]},
                margin: {left: 14, right: 14},
                didParseCell: (data) => {
                    if (data.column.index === 3 && data.cell.raw === 'WINNER') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [16, 185, 129];
                    }
                }
            });

            // Overall match result
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            // @ts-expect-error autoTable adds lastAutoTable to doc
            doc.text(`Final Result: ${matchResult}`, 14, doc.lastAutoTable.finalY + 10);

            // @ts-expect-error autoTable adds lastAutoTable to doc
            scorecardStartY = doc.lastAutoTable.finalY + 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Scorecard - Front 9', 14, scorecardStartY);

        // Sort scores by hole number
        const sortedScores = [...round.scores].sort((a, b) => a.holeNumber - b.holeNumber);

        // Helper to build scorecard for a range of holes
        const buildScorecardData = (startHole: number, endHole: number) => {
            // Headers: blank + hole numbers + Out/In total
            const headers = [''];
            for (let h = startHole; h <= endHole; h++) {
                headers.push(h.toString());
            }
            headers.push(startHole === 1 ? 'Out' : 'In');

            // Par row
            let parTotal = 0;
            const parRow = ['Par'];
            for (let h = startHole; h <= endHole; h++) {
                const holeData = round.course.holes.find(hole => hole.hole_number === h);
                const par = holeData?.hole_par || 0;
                parTotal += par;
                parRow.push(par.toString());
            }
            parRow.push(parTotal.toString());

            // SI row
            const siRow = ['SI'];
            for (let h = startHole; h <= endHole; h++) {
                const holeData = round.course.holes.find(hole => hole.hole_number === h);
                siRow.push(holeData?.hole_stroke.toString() || '-');
            }
            siRow.push('-');

            // Track pink ball cells for styling: {rowIndex: {colIndex: true}}
            const pinkCells: Record<number, Record<number, boolean>> = {};

            // Player rows (strokes and points for each)
            const playerRows: string[][] = [];
            round.players.forEach(p => {
                let strokesTotal = 0;
                let pointsTotal = 0;
                const strokesRow = [`${p.name}`];
                const pointsRow = [`${p.name} Pts`];
                const strokesRowIndex = playerRows.length + 2; // +2 for par and SI rows
                const pointsRowIndex = strokesRowIndex + 1;

                for (let h = startHole; h <= endHole; h++) {
                    const holeScore = sortedScores.find(s => s.holeNumber === h);
                    const ps = holeScore?.playerScores.find(s => s.playerId === p.id);
                    const strokes = ps?.strokes || 0;
                    const points = ps?.points || 0;
                    strokesTotal += strokes;
                    pointsTotal += points;
                    strokesRow.push(strokes > 0 ? strokes.toString() : '-');
                    pointsRow.push(points >= 0 && strokes > 0 ? points.toString() : '-');

                    // Check if this player had pink ball on this hole
                    // Mark both strokes cell AND points cell as pink
                    if (holeScore?.pinkPlayerId === p.id && points > 0) {
                        const colIndex = h - startHole + 1; // +1 for label column
                        if (!pinkCells[strokesRowIndex]) pinkCells[strokesRowIndex] = {};
                        if (!pinkCells[pointsRowIndex]) pinkCells[pointsRowIndex] = {};
                        pinkCells[strokesRowIndex][colIndex] = true;
                        pinkCells[pointsRowIndex][colIndex] = true;
                    }
                }
                strokesRow.push(strokesTotal.toString());
                pointsRow.push(pointsTotal.toString());
                playerRows.push(strokesRow);
                playerRows.push(pointsRow);
            });

            // Winner row for team matches
            const winnerRow: string[] = [];
            if (round.format === 'teams' && round.teams && round.teams.length === 2) {
                winnerRow.push('Winner');
                let team1Wins = 0;
                let team2Wins = 0;
                for (let h = startHole; h <= endHole; h++) {
                    const result = getHoleWinner(h);
                    if (result.winner === round.teams[0].name) {
                        winnerRow.push(round.teams[0].name.substring(0, 8));
                        team1Wins++;
                    } else if (result.winner === round.teams[1].name) {
                        winnerRow.push(round.teams[1].name.substring(0, 8));
                        team2Wins++;
                    } else if (result.winner === 'Halved') {
                        winnerRow.push('Halved');
                    } else {
                        winnerRow.push('-');
                    }
                }
                winnerRow.push(`${team1Wins}-${team2Wins}`);
            }

            const bodyRows = [parRow, siRow, ...playerRows];
            if (winnerRow.length > 0) {
                bodyRows.push(winnerRow);
            }

            return {headers, body: bodyRows, pinkCells};
        };

        // Front 9 table
        const front9 = buildScorecardData(1, 9);
        autoTable(doc, {
            startY: scorecardStartY + 5,
            head: [front9.headers],
            body: front9.body,
            theme: 'grid',
            headStyles: {fillColor: [59, 130, 246], fontSize: 8, halign: 'center'},
            bodyStyles: {fontSize: 8, halign: 'center'},
            columnStyles: {0: {halign: 'left', fontStyle: 'bold'}},
            margin: {left: 14, right: 14},
            styles: {cellPadding: 2},
            didParseCell: (data) => {
                // Apply pink background to cells where player had pink ball
                if (data.row.index !== undefined && front9.pinkCells[data.row.index]?.[data.column.index]) {
                    data.cell.styles.fillColor = [236, 72, 153]; // Pink color
                    data.cell.styles.textColor = [255, 255, 255]; // White text
                }
            }
        });

        // Back 9 table
        // @ts-expect-error autoTable adds lastAutoTable to doc
        const back9StartY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Scorecard - Back 9', 14, back9StartY);

        const back9 = buildScorecardData(10, 18);
        autoTable(doc, {
            startY: back9StartY + 5,
            head: [back9.headers],
            body: back9.body,
            theme: 'grid',
            headStyles: {fillColor: [59, 130, 246], fontSize: 8, halign: 'center'},
            bodyStyles: {fontSize: 8, halign: 'center'},
            columnStyles: {0: {halign: 'left', fontStyle: 'bold'}},
            margin: {left: 14, right: 14},
            styles: {cellPadding: 2},
            didParseCell: (data) => {
                // Apply pink background to cells where player had pink ball
                if (data.row.index !== undefined && back9.pinkCells[data.row.index]?.[data.column.index]) {
                    data.cell.styles.fillColor = [236, 72, 153]; // Pink color
                    data.cell.styles.textColor = [255, 255, 255]; // White text
                }
            }
        });

        // Save the PDF
        const fileName = `${round.course.name.replace(/\s+/g, '_')}_${round.date}.pdf`;
        doc.save(fileName);
    }

    return (
        <div className="page-with-background">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content">
                <div className="rounds-container">
                    <div className="page-header-glass">
                        <h1>🏆 Rounds</h1>
                        <span className="count-badge">{rounds.length} round{rounds.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="action-bar">
                        <button className="button-primary" onClick={handleAddRoundClick}>
                            <span style={{marginRight: '8px'}}>➕</span> Create Round
                        </button>
                    </div>

                    {rounds.length === 0 ? (
                        <div className="empty-state-glass">
                            <div className="empty-icon">🏆</div>
                            <h3>No Rounds Yet</h3>
                            <p>Create your first round to start scoring</p>
                        </div>
                    ) : (
                        <div className="rounds-grid">
                            {rounds.map((round) => (
                                <div key={round.id}
                                     className={`round-card glass-card ${round.completed ? 'completed' : 'in-progress'}`}>
                                    <div className="card-header">
                                        <div className="course-info">
                                            <div className="course-name">{round.course.name}</div>
                                            <div className="round-meta">
                                                <span className="meta-item date">{formatDate(round.date)}</span>
                                                <span
                                                    className="meta-item scoring-method">{round.scoring_method.name}</span>
                                            </div>
                                        </div>
                                        <div className="status-section">
                                        <span
                                            className={`status-badge ${round.completed ? 'completed' : 'in-progress'}`}>
                                            {round.completed ? 'Completed' : 'In Progress'}
                                        </span>
                                            {round.scores.length > 0 && (
                                                <span className="hole-progress">{round.scores.length}/18</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        {round.completed ? (
                                            <>
                                                <button className="action-btn view"
                                                        onClick={() => handleViewRoundClick(round)}
                                                        title="View round">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                        <circle cx="12" cy="12" r="3"></circle>
                                                    </svg>
                                                </button>
                                                <button className="action-btn export"
                                                        onClick={() => handleExportRound(round)}
                                                        title="Export to PDF">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                </button>
                                            </>
                                        ) : (
                                            <button className="action-btn play"
                                                    onClick={() => handleEditRoundClick(round)}
                                                    title="Continue round">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                                </svg>
                                            </button>
                                        )}
                                        <button className="action-btn danger"
                                                onClick={() => handleDeleteClick(round)}
                                                title="Delete round">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                 strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path
                                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {showRoundModal && <AddRoundModal
                onCloseModal={handleCloseModalClick}
                onRoundCreated={handleRoundCreated}
            ></AddRoundModal>}

            {roundToDelete && (
                <div className="modal-overlay">
                    <div className="modal confirm-modal">
                        <div className="modal-header">
                            <h2>Delete Round</h2>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this round
                                at <strong>{roundToDelete.course.name}</strong> on <strong>{formatDate(roundToDelete.date)}</strong>?
                            </p>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="button-secondary" onClick={handleCancelDelete}>Cancel</button>
                            <button className="button-danger" onClick={handleConfirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

}
export default Rounds
