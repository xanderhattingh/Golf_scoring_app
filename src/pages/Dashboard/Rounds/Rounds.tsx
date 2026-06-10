import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Capacitor} from '@capacitor/core';
import type {Round} from "../../../services/LocalDataService.ts";
import HttpService from "../../../services/HttpService.ts";

import "../../../styles/Pages/Rounds.scss"
import "../../../styles/Shared/backgrounds.scss"
import AddRoundModal from "../../../components/AddRoundModal.tsx";
import AuthCrest from "../../../components/AuthCrest.tsx";
import golfBg from "../../../assets/golf-bg-4.jpg";

const Rounds = () => {
    const navigate = useNavigate();
    const [rounds, setRounds] = useState([]);
    const [showRoundModal, setShowRoundModal] = useState(false);
    const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);

    useEffect(() => {
        const httpService = new HttpService();
        httpService.get('rounds')
            .then((response) => {
                setRounds(response.data?.data || []);
            })
            .catch(() => {
                setRounds([]);
            });
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
            const httpService = new HttpService();
            httpService.delete(`rounds/${roundToDelete.id}`)
                .then(() => {
                    setRounds((old) => old.filter((r) => r.id !== roundToDelete.id));
                    setRoundToDelete(null);
                })
                .catch(() => {
                    setRoundToDelete(null);
                });
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

    const getInitials = (name: string): string => {
        return (name || '')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?';
    }

    const handleExportRound = async (round: Round) => {
        let fullRound = round;
        if (!round.scores || round.scores.length !== (round.scores_count ?? 0)) {
            try {
                const httpService = new HttpService();
                const response = await httpService.get(`rounds/${round.id}`);
                if (response.data?.success) {
                    fullRound = response.data.data;
                }
            } catch (e) {
                console.error('Failed to fetch full round for export:', e);
            }
        }

        fullRound.scores = fullRound.scores || [];

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Golf Scorecard', pageWidth / 2, 20, {align: 'center'});

        // Round info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        let currentY = 35;
        const maxTextWidth = pageWidth - 28;

        doc.text(`Course: ${fullRound.course.name}`, 14, currentY);
        currentY += 7;
        doc.text(`Date: ${formatDate(fullRound.date)}`, 14, currentY);
        currentY += 7;
        doc.text(`Format: ${fullRound.format === 'teams' ? 'Teams' : 'Individual'}`, 14, currentY);
        currentY += 7;
        doc.text(`Scoring: ${fullRound.scoring_method.name}`, 14, currentY);
        currentY += 7;

        // Players (wrapped)
        const playerNames = fullRound.players.map(p => `${p.name} (HC: ${p.handicap})`).join(', ');
        const playersText = `Players: ${playerNames}`;
        const playersLines = doc.splitTextToSize(playersText, maxTextWidth);
        doc.text(playersLines, 14, currentY);
        currentY += playersLines.length * 7;

        // Teams (if applicable, wrapped)
        if (fullRound.format === 'teams' && fullRound.teams) {
            const teamInfo = fullRound.teams.map(t => {
                const members = t.playerIds.map(pid => fullRound.players.find(p => p.id === pid)?.name).join(' & ');
                return `${t.name}: ${members}`;
            }).join(' | ');
            const teamsText = `Teams: ${teamInfo}`;
            const teamsLines = doc.splitTextToSize(teamsText, maxTextWidth);
            doc.text(teamsLines, 14, currentY);
            currentY += teamsLines.length * 7;
        }

        // Calculate player totals
        const playerTotals: Record<number, { strokes: number; points: number }> = {};
        fullRound.players.forEach(p => {
            playerTotals[p.id] = {strokes: 0, points: 0};
        });
        fullRound.scores.forEach(holeScore => {
            holeScore.playerScores.forEach(ps => {
                if (playerTotals[ps.playerId]) {
                    playerTotals[ps.playerId].strokes += ps.strokes;
                    playerTotals[ps.playerId].points += ps.points;
                }
            });
        });

        // Summary table
        const summaryStartY = currentY + 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, summaryStartY);

        const summaryHeaders = ['Player', 'Handicap', 'Total Strokes', 'Total Points'];
        const summaryData = fullRound.players.map(p => [
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
            headStyles: {fillColor: [45, 90, 39]},
            margin: {left: 14, right: 14}
        });

        // Helper to get hole winner for team matches
        const getHoleWinner = (holeNumber: number): { winner: string; team1Best: number; team2Best: number } => {
            if (!fullRound.teams || fullRound.teams.length < 2) {
                return {winner: '-', team1Best: 0, team2Best: 0};
            }
            const holeScore = fullRound.scores.find(s => s.holeNumber === holeNumber);
            if (!holeScore) return {winner: '-', team1Best: 0, team2Best: 0};

            const team1Best = Math.max(
                ...fullRound.teams[0].playerIds.map(pid => {
                    const ps = holeScore.playerScores.find(p => p.playerId === pid);
                    return ps?.points || 0;
                })
            );
            const team2Best = Math.max(
                ...fullRound.teams[1].playerIds.map(pid => {
                    const ps = holeScore.playerScores.find(p => p.playerId === pid);
                    return ps?.points || 0;
                })
            );

            if (team1Best > team2Best) return {winner: fullRound.teams[0].name, team1Best, team2Best};
            if (team2Best > team1Best) return {winner: fullRound.teams[1].name, team1Best, team2Best};
            return {winner: 'Halved', team1Best, team2Best};
        };

        // Team Match Results (if team format)
        // @ts-expect-error autoTable adds lastAutoTable to doc
        let scorecardStartY = doc.lastAutoTable.finalY + 15;

        if (fullRound.format === 'teams' && fullRound.teams && fullRound.teams.length === 2) {
            // Calculate team results
            let team1Wins = 0;
            let team2Wins = 0;
            let halved = 0;

            for (let h = 1; h <= 18; h++) {
                const result = getHoleWinner(h);
                if (result.winner === fullRound.teams[0].name) team1Wins++;
                else if (result.winner === fullRound.teams[1].name) team2Wins++;
                else if (result.winner === 'Halved') halved++;
            }

            const diff = team1Wins - team2Wins;
            let matchResult = 'All Square';
            if (diff > 0) {
                matchResult = `${fullRound.teams[0].name} wins ${diff} up`;
            } else if (diff < 0) {
                matchResult = `${fullRound.teams[1].name} wins ${Math.abs(diff)} up`;
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
                    [fullRound.teams[0].name, team1Wins.toString(), halved.toString(), diff > 0 ? 'WINNER' : (diff === 0 ? 'DRAW' : '')],
                    [fullRound.teams[1].name, team2Wins.toString(), halved.toString(), diff < 0 ? 'WINNER' : (diff === 0 ? 'DRAW' : '')]
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
        const sortedScores = [...fullRound.scores].sort((a, b) => a.holeNumber - b.holeNumber);

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
                const holeData = fullRound.course.holes.find(hole => hole.hole_number === h);
                const par = holeData?.hole_par || 0;
                parTotal += par;
                parRow.push(par.toString());
            }
            parRow.push(parTotal.toString());

            // SI row
            const siRow = ['SI'];
            for (let h = startHole; h <= endHole; h++) {
                const holeData = fullRound.course.holes.find(hole => hole.hole_number === h);
                siRow.push(holeData?.hole_stroke.toString() || '-');
            }
            siRow.push('-');

            // Track pink ball cells for styling: {rowIndex: {colIndex: true}}
            const pinkCells: Record<number, Record<number, boolean>> = {};

            // Player rows (strokes and points for each)
            const playerRows: string[][] = [];
            fullRound.players.forEach(p => {
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
                    if (holeScore?.pinkPlayerId === p.id && strokes > 0) {
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
            if (fullRound.format === 'teams' && fullRound.teams && fullRound.teams.length === 2) {
                winnerRow.push('Winner');
                let team1Wins = 0;
                let team2Wins = 0;
                for (let h = startHole; h <= endHole; h++) {
                    const result = getHoleWinner(h);
                    if (result.winner === fullRound.teams[0].name) {
                        winnerRow.push(fullRound.teams[0].name.substring(0, 8));
                        team1Wins++;
                    } else if (result.winner === fullRound.teams[1].name) {
                        winnerRow.push(fullRound.teams[1].name.substring(0, 8));
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
            headStyles: {fillColor: [45, 90, 39], fontSize: 8, halign: 'center'},
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
            headStyles: {fillColor: [45, 90, 39], fontSize: 8, halign: 'center'},
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
        const fileName = `${fullRound.course.name.replace(/\s+/g, '_')}_${fullRound.date}.pdf`;
        
        // Check if running on native mobile platform
        if (Capacitor.isNativePlatform()) {
            // Mobile: Save to filesystem and share
            const pdfOutput = doc.output('datauristring');
            const base64Data = pdfOutput.split(',')[1];
            
            try {
                // Write file to cache directory
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache,
                    recursive: true
                });
                
                // Share the file
                await Share.share({
                    title: `Golf Scorecard - ${fullRound.course.name}`,
                    text: `Scorecard for ${fullRound.course.name} on ${formatDate(fullRound.date)}`,
                    url: result.uri,
                    dialogTitle: 'Share Scorecard'
                });
            } catch (error) {
                console.error('Error saving/sharing PDF:', error);
                alert('Failed to export PDF. Please try again.');
            }
        } else {
            // Web: Use standard download
            doc.save(fileName);
        }
    }

    return (
        <div className="page-with-background">
            <div
                className="page-background"
                style={{backgroundImage: `url(${golfBg})`}}
            />
            <div className="page-content">
                <div className="rounds-container">
                    <header className="clubhouse-header">
                        <div className="clubhouse-header__crest">
                            <AuthCrest />
                        </div>
                        <div className="clubhouse-header__titles">
                            <h1>Rounds</h1>
                            <span className="clubhouse-header__sub">
                                {rounds.length} round{rounds.length !== 1 ? 's' : ''} on the card
                            </span>
                        </div>
                    </header>

                    <div className="rounds-toolbar">
                        <button className="btn-round btn-round--add" onClick={handleAddRoundClick}>
                            <span className="btn-round__plus">+</span> Create Round
                        </button>
                    </div>

                    {rounds.length === 0 ? (
                        <div className="rounds-empty">
                            <div className="rounds-empty__crest">
                                <AuthCrest />
                            </div>
                            <h3>No rounds yet</h3>
                            <p>Tee off your first round to start keeping score.</p>
                            <button className="btn-round btn-round--add" onClick={handleAddRoundClick}>
                                <span className="btn-round__plus">+</span> Create Round
                            </button>
                        </div>
                    ) : (
                        <div className="rounds-grid">
                            {rounds.map((round) => {
                                const holesPlayed = round.scores?.length || round.scores_count || 0;
                                const pct = Math.min(100, Math.round((holesPlayed / 18) * 100));
                                const players = round.players || [];
                                return (
                                    <article key={round.id}
                                             className={`round-card ${round.completed ? 'round-card--done' : 'round-card--active'}`}>
                                        <div className="round-card__top">
                                            <div className="round-card__head">
                                                <h2>{round.course.name}</h2>
                                                <div className="round-card__sub">
                                                    <span className="round-card__date">{formatDate(round.date)}</span>
                                                    <span className="round-card__method">{round.scoring_method.name}</span>
                                                    {round.format === 'teams' && (
                                                        <span className="round-card__format">Teams</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`round-status ${round.completed ? 'round-status--done' : 'round-status--active'}`}>
                                                {round.completed ? 'Completed' : 'In Progress'}
                                            </span>
                                        </div>

                                        {players.length > 0 && (
                                            <div className="round-card__players">
                                                <div className="round-card__avatars">
                                                    {players.slice(0, 4).map((p) => (
                                                        <span key={p.id} className="round-avatar" title={p.name}>
                                                            {getInitials(p.name)}
                                                        </span>
                                                    ))}
                                                    {players.length > 4 && (
                                                        <span className="round-avatar round-avatar--more">
                                                            +{players.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="round-card__pcount">
                                                    {players.length} player{players.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}

                                        <div className="round-card__progress">
                                            <div className="round-card__bar">
                                                <span style={{width: `${pct}%`}} />
                                            </div>
                                            <span className="round-card__holes">{holesPlayed}/18</span>
                                        </div>

                                        <div className="round-card__actions">
                                            {round.completed ? (
                                                <>
                                                    <button className="round-card__btn round-card__btn--primary"
                                                            onClick={() => handleViewRoundClick(round)}
                                                            title="View round">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                            <circle cx="12" cy="12" r="3"></circle>
                                                        </svg>
                                                        View
                                                    </button>
                                                    <button className="round-card__btn round-card__btn--gold"
                                                            onClick={() => handleExportRound(round)}
                                                            title="Export to PDF">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <button className="round-card__btn round-card__btn--primary"
                                                        onClick={() => handleEditRoundClick(round)}
                                                        title="Continue round">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                                    </svg>
                                                    Continue
                                                </button>
                                            )}
                                            <button className="round-card__btn round-card__btn--danger"
                                                    onClick={() => handleDeleteClick(round)}
                                                    title="Delete round">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                     viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                     strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
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
