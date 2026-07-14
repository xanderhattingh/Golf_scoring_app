import {useEffect, useState, useRef} from "react";
import {createPortal} from "react-dom";
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Capacitor} from '@capacitor/core';
import HttpService from "../../../services/HttpService.ts";
import StorageService from "../../../services/StorageService.ts";
import AuthCrest from "../../../components/AuthCrest.tsx";
import ConfirmDialog from "../../../components/ConfirmDialog.tsx";
import CreateTournamentModal from "../../../components/CreateTournamentModal.tsx";
import toast from "react-simple-toasts";

import "../../../styles/Pages/Tournament.scss";
import "../../../styles/Shared/backgrounds.scss";
import golfBg from "../../../assets/golf-bg-5.jpg";

interface TournamentPlayer {
    id: number;
    name: string;
    surname?: string;
    handicap: number;
    holes_played: number;
    strokes: number;
    points: number;
}

// A team-standings row — used by both Four Ball Alliance (keyed by round_id) and
// Betterball Stableford (keyed by team id, with a team name).
interface TeamResult {
    round_id?: number;
    id?: number;
    name?: string;
    total: number;
    holes_played: number;
    players: TournamentPlayer[];
}

interface Tournament {
    id: number;
    name: string;
    description: string | null;
    creator_id: number;
    status: number;
    course: { id: number; name: string; location?: string | null; num_holes?: number } | null;
    scoring_method: { id: number; name: string } | null;
    scoring_config?: { alliance?: { par3: number; par4: number; par5: number } } | null;
    date: string | null;
    invite_code: string | null;
    players: TournamentPlayer[];
    alliances?: TeamResult[];
    betterball_teams?: TeamResult[];
    round_ids?: number[];
}

// Full per-round detail (from GET /rounds/{id}) — used to draw scorecards in the export.
interface RoundDetail {
    id: number;
    course: { name: string; holes: { hole_number: number; hole_par: number; hole_stroke: number }[] };
    players: { id: number; name: string; handicap: number }[];
    scoring_method: { id: number; name: string };
    scoring_config?: { alliance?: { par3: number; par4: number; par5: number } } | null;
    teams?: { id: number; name: string; playerIds: number[] }[];
    scores: { holeNumber: number; playerScores: { playerId: number; strokes: number; points: number }[] }[];
}

const Tournament = () => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [standingsFor, setStandingsFor] = useState<Tournament | null>(null);
    const [expandedAlliance, setExpandedAlliance] = useState<number | null>(null);
    const [toDelete, setToDelete] = useState<Tournament | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    // Read-only scorecard opened by tapping a player on the leaderboard
    const [scorecard, setScorecard] = useState<{ round: RoundDetail; playerId: number; playerName: string } | null>(null);
    const [scorecardLoading, setScorecardLoading] = useState(false);
    // Cache of fetched round details per tournament id, so reopening is instant
    const roundCacheRef = useRef<Record<number, RoundDetail[]>>({});

    const currentUser = new StorageService().getUser();

    useEffect(() => {
        const httpService = new HttpService();
        httpService.get('tournaments')
            .then((response) => {
                const data = response.data?.data;
                setTournaments(Array.isArray(data) ? data : (data ? [data] : []));
            })
            .catch(() => setTournaments([]))
            .finally(() => setIsLoading(false));
    }, []);

    const getInitials = (player: TournamentPlayer): string => {
        const full = `${player.name || ''} ${player.surname || ''}`.trim();
        return full.split(' ').filter(Boolean).map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase() || '?';
    };

    const getPlayers = (t: Tournament): TournamentPlayer[] => t.players || [];

    const methodId = (t: Tournament | null) => t?.scoring_method?.id;
    const isMedal = (t: Tournament | null) => methodId(t) === 7;
    const isAlliance = (t: Tournament | null) => methodId(t) === 8 || methodId(t) === 11;
    const isBetterball = (t: Tournament | null) => methodId(t) === 9 || methodId(t) === 10;
    // Alliance, betterball & worst ball are all ranked as teams
    const isTeamStandings = (t: Tournament | null) => isAlliance(t) || isBetterball(t);
    // Stroke Play (1) & Medal (7) rank on strokes/net; everything else on points
    const isStrokeRanked = (t: Tournament | null) => methodId(t) === 1 || methodId(t) === 7;
    const playerNet = (p: TournamentPlayer) => p.strokes - (p.handicap || 0);
    // Whether to show a points column (Stableford-style: not Stroke Play, not Medal)
    const awardsPoints = (t: Tournament | null): boolean => !!t && !isStrokeRanked(t);

    // Players sorted into a leaderboard: started players first (ranked by the method's
    // metric — net for Medal, gross for Stroke Play, points otherwise), then yet-to-start.
    const getStandings = (t: Tournament): TournamentPlayer[] => {
        return [...(t.players || [])].sort((a, b) => {
            const aStarted = a.holes_played > 0;
            const bStarted = b.holes_played > 0;
            if (aStarted !== bStarted) return aStarted ? -1 : 1;
            if (!aStarted) return a.name.localeCompare(b.name);
            if (isMedal(t)) return playerNet(a) - playerNet(b);
            if (methodId(t) === 1) return a.strokes - b.strokes;
            return b.points - a.points || a.strokes - b.strokes;
        });
    };

    // Teams ranked by total (alliance best-N, or betterball better-ball), started first
    const getTeamStandings = (t: Tournament): TeamResult[] => {
        const list = isAlliance(t) ? (t.alliances || []) : (t.betterball_teams || []);
        return [...list].sort((a, b) => {
            const aStarted = a.holes_played > 0;
            const bStarted = b.holes_played > 0;
            if (aStarted !== bStarted) return aStarted ? -1 : 1;
            return b.total - a.total;
        });
    };
    const teamKey = (tm: TeamResult) => tm.id ?? tm.round_id ?? 0;
    const teamLabel = (tm: TeamResult) => tm.name || tm.players.map(p => p.name).join(', ') || 'Team';

    // Tap a leaderboard player -> load the round they're in and show a read-only scorecard.
    const openScorecard = async (t: Tournament, playerId: number, playerName: string) => {
        setScorecardLoading(true);
        try {
            let rounds = roundCacheRef.current[t.id];
            if (!rounds) {
                const http = new HttpService();
                const ids = t.round_ids || [];
                rounds = (await Promise.all(ids.map(async (id) => {
                    try {
                        const r = await http.get(`rounds/${id}`);
                        return r.data?.success ? (r.data.data as RoundDetail) : null;
                    } catch {
                        return null;
                    }
                }))).filter((r): r is RoundDetail => r !== null);
                roundCacheRef.current[t.id] = rounds;
            }
            const round = rounds.find(r => r.players.some(p => p.id === playerId));
            if (!round) {
                toast('No scorecard available for this player yet', {className: 'error-toast'});
                return;
            }
            setScorecard({round, playerId, playerName});
        } finally {
            setScorecardLoading(false);
        }
    };

    const handleAddTournament = () => {
        setShowCreate(true);
    };

    const handleTournamentCreated = (created: Tournament) => {
        setTournaments((old) => [created, ...old]);
    };

    const copyInviteCode = (code: string) => {
        navigator.clipboard?.writeText(code)
            .then(() => toast(`Invite code ${code} copied`, {className: "success-toast"}))
            .catch(() => toast(`Invite code: ${code}`, {className: "success-toast"}));
    };

    const formatDate = (dateString: string | null): string => {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
    };

    const handleConfirmDelete = () => {
        if (!toDelete) return;
        const id = toDelete.id;
        const httpService = new HttpService();
        httpService.delete(`tournaments/${id}`)
            .then(() => {
                setTournaments((old) => old.filter(t => t.id !== id));
                toast("Tournament deleted", {className: "success-toast"});
            })
            .catch((error: any) => {
                toast(error.response?.data?.message || "Failed to delete tournament", {className: "error-toast"});
            })
            .finally(() => setToDelete(null));
    };

    // Export final tournament results to PDF (completed tournaments only)
    const handleExportTournament = async (t: Tournament) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        // Push the next block to a fresh page if it won't fit, so a table header
        // never gets orphaned at the bottom of a page.
        const ensureSpace = (yPos: number, needed: number) =>
            (yPos + needed > pageHeight - 12) ? (doc.addPage(), 20) : yPos;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Tournament Results', pageWidth / 2, 20, {align: 'center'});

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let y = 35;
        doc.text(`Tournament: ${t.name}`, 14, y); y += 7;
        if (t.course) { doc.text(`Course: ${t.course.name}`, 14, y); y += 7; }
        doc.text(`Scoring: ${t.scoring_method?.name || ''}`, 14, y); y += 7;
        if (t.date) { doc.text(`Date: ${formatDate(t.date)}`, 14, y); y += 7; }
        doc.text('Status: Completed', 14, y); y += 7;

        if (isTeamStandings(t)) {
            const teams = getTeamStandings(t);
            const totalLabel = isBetterball(t) && methodId(t) === 10 ? 'Worst Ball'
                : isBetterball(t) ? 'Better Ball' : 'Total';
            autoTable(doc, {
                startY: y + 5,
                head: [['#', 'Team', 'Players', totalLabel]],
                body: teams.map((tm, i) => [
                    (i + 1).toString(),
                    teamLabel(tm),
                    tm.players.map(p => `${p.name} ${p.surname || ''}`.trim()).join(', '),
                    tm.total.toString(),
                ]),
                theme: 'striped', styles: {fontSize: 9},
                headStyles: {fillColor: [45, 90, 39]},
                margin: {left: 14, right: 14},
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 3) data.cell.styles.fontStyle = 'bold';
                },
            });
        } else {
            const players = getStandings(t);
            const isM = isMedal(t);
            const isStrokeM = methodId(t) === 1;
            const metricHead = isM ? 'Net' : isStrokeM ? 'Strokes' : 'Points';
            const metricVal = (p: TournamentPlayer) => isM ? playerNet(p) : isStrokeM ? p.strokes : p.points;
            autoTable(doc, {
                startY: y + 5,
                head: [['#', 'Player', 'Hcp', 'Strokes', metricHead]],
                body: players.map((p, i) => [
                    (i + 1).toString(),
                    `${p.name} ${p.surname || ''}`.trim(),
                    p.handicap.toString(),
                    p.strokes.toString(),
                    metricVal(p).toString(),
                ]),
                theme: 'striped', styles: {fontSize: 9},
                headStyles: {fillColor: [45, 90, 39]},
                margin: {left: 14, right: 14},
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 4) data.cell.styles.fontStyle = 'bold';
                },
            });
        }

        // ---- Per-fourball scorecards ----
        // Pull every round's full detail (hole-by-hole) and draw a scorecard for each.
        const mid = methodId(t);
        const usesPoints = mid !== 1 && mid !== 7;     // Stableford-based methods carry points
        const isAllianceM = mid === 8 || mid === 11;
        const isWorstballM = mid === 10;
        const isTeamTotalM = mid === 9 || mid === 10;

        const httpService = new HttpService();
        const details = (await Promise.all((t.round_ids || []).map(async (id) => {
            try {
                const r = await httpService.get(`rounds/${id}`);
                return r.data?.success ? (r.data.data as RoundDetail) : null;
            } catch (e) {
                console.error(`Failed to fetch round ${id} for export:`, e);
                return null;
            }
        }))).filter((r): r is RoundDetail => r !== null);

        // Best-N alliance points on a hole (N by par, from the tournament config)
        const alliancePerHole = (fr: RoundDetail, h: number): number | null => {
            const hs = fr.scores.find(s => s.holeNumber === h);
            const cfg = fr.scoring_config?.alliance;
            if (!hs || !cfg) return null;
            const par = fr.course.holes.find(x => x.hole_number === h)?.hole_par || 4;
            const n = par === 3 ? cfg.par3 : par === 5 ? cfg.par5 : cfg.par4;
            return hs.playerScores.map(p => p.points).sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
        };
        // Better/worst counting ball for a team on a hole
        const teamHoleScore = (fr: RoundDetail, team: { playerIds: number[] }, h: number): number | null => {
            const hs = fr.scores.find(s => s.holeNumber === h);
            if (!hs) return null;
            const pts = team.playerIds
                .map(pid => hs.playerScores.find(p => p.playerId === pid)?.points)
                .filter((v): v is number => v !== undefined);
            if (!pts.length) return null;
            return isWorstballM ? Math.min(...pts) : Math.max(...pts);
        };

        const buildCard = (fr: RoundDetail, startHole: number, endHole: number) => {
            const headers = [''];
            for (let h = startHole; h <= endHole; h++) headers.push(h.toString());
            headers.push(startHole === 1 ? 'Out' : 'In');

            const holePar = (h: number) => fr.course.holes.find(x => x.hole_number === h)?.hole_par || 0;
            const holeSI = (h: number) => fr.course.holes.find(x => x.hole_number === h)?.hole_stroke;

            let parTotal = 0;
            const parRow = ['Par'];
            for (let h = startHole; h <= endHole; h++) { parTotal += holePar(h); parRow.push(holePar(h).toString()); }
            parRow.push(parTotal.toString());

            const siRow = ['SI'];
            for (let h = startHole; h <= endHole; h++) siRow.push(holeSI(h)?.toString() || '-');
            siRow.push('-');

            const playerRows: string[][] = [];
            fr.players.forEach(p => {
                let strokesTotal = 0, pointsTotal = 0;
                const strokesRow = [p.name];
                const pointsRow = ['Pts'];
                for (let h = startHole; h <= endHole; h++) {
                    const ps = fr.scores.find(s => s.holeNumber === h)?.playerScores.find(s => s.playerId === p.id);
                    const strokes = ps?.strokes || 0;
                    const points = ps?.points || 0;
                    strokesTotal += strokes; pointsTotal += points;
                    strokesRow.push(strokes > 0 ? strokes.toString() : '-');
                    pointsRow.push(strokes > 0 ? points.toString() : '-');
                }
                strokesRow.push(strokesTotal.toString());
                pointsRow.push(pointsTotal.toString());
                playerRows.push(strokesRow);
                if (usesPoints) playerRows.push(pointsRow);
            });

            const extraRows: string[][] = [];
            if (isAllianceM) {
                const row = ['Alliance']; let tot = 0;
                for (let h = startHole; h <= endHole; h++) {
                    const v = alliancePerHole(fr, h);
                    row.push(v === null ? '-' : v.toString());
                    if (v !== null) tot += v;
                }
                row.push(tot.toString());
                extraRows.push(row);
            } else if (isTeamTotalM && fr.teams) {
                fr.teams.forEach(team => {
                    const row = [`${team.name} ${isWorstballM ? '(WB)' : '(BB)'}`]; let tot = 0;
                    for (let h = startHole; h <= endHole; h++) {
                        const v = teamHoleScore(fr, team, h);
                        row.push(v === null ? '-' : v.toString());
                        if (v !== null) tot += v;
                    }
                    row.push(tot.toString());
                    extraRows.push(row);
                });
            }

            return {headers, body: [parRow, siRow, ...playerRows, ...extraRows]};
        };

        const drawNine = (fr: RoundDetail, startHole: number, endHole: number, label: string, startY: number): number => {
            const card = buildCard(fr, startHole, endHole);
            const yPos = ensureSpace(startY, 12 + card.body.length * 6);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(label, 14, yPos);
            autoTable(doc, {
                startY: yPos + 3,
                head: [card.headers],
                body: card.body,
                theme: 'grid',
                headStyles: {fillColor: [45, 90, 39], fontSize: 7, halign: 'center'},
                bodyStyles: {fontSize: 7, halign: 'center'},
                columnStyles: {0: {halign: 'left', fontStyle: 'bold'}},
                margin: {left: 14, right: 14},
                styles: {cellPadding: 1.5},
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const lbl = Array.isArray(data.row.raw) ? String(data.row.raw[0]) : '';
                        if (lbl !== 'Par' && lbl !== 'SI' &&
                            (lbl.indexOf('Pts') > -1 || lbl.indexOf('Alliance') > -1 || lbl.indexOf('(BB)') > -1 || lbl.indexOf('(WB)') > -1)) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 0, 0];
                        }
                    }
                },
            });
            // @ts-expect-error autoTable adds lastAutoTable to doc
            return doc.lastAutoTable.finalY;
        };

        // Per-round heading matches the round size (Twoball / Threeball / Fourball)
        // so a 2-ball alliance doesn't get labelled "Fourball".
        const groupLabel = (n: number) =>
            n === 2 ? 'Twoball' : n === 3 ? 'Threeball' : n === 4 ? 'Fourball' : 'Group';

        details.forEach((fr, idx) => {
            const names = fr.players.map(p => p.name).join(', ');
            // @ts-expect-error autoTable adds lastAutoTable to doc
            let cardY = ensureSpace((doc.lastAutoTable?.finalY || y) + 12, 30);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${groupLabel(fr.players.length)} ${idx + 1} - ${names}`, 14, cardY);
            cardY += 6;
            cardY = drawNine(fr, 1, 9, 'Front 9', cardY);
            drawNine(fr, 10, 18, 'Back 9', cardY + 8);
        });

        const fileName = `${t.name.replace(/\s+/g, '_')}_results.pdf`;
        if (Capacitor.isNativePlatform()) {
            try {
                const base64Data = doc.output('datauristring').split(',')[1];
                const result = await Filesystem.writeFile({path: fileName, data: base64Data, directory: Directory.Cache, recursive: true});
                await Share.share({title: `${t.name} - Results`, url: result.uri, dialogTitle: 'Share Results'});
            } catch (e) {
                console.error('Error sharing tournament PDF:', e);
                toast('Failed to export results', {className: 'error-toast'});
            }
        } else {
            doc.save(fileName);
        }
    };

    return (
        <div className="page-with-background">
            <div className="page-background" style={{backgroundImage: `url(${golfBg})`}} />
            <div className="page-content">
                <div className="tournaments-container">
                    <header className="clubhouse-header">
                        <div className="clubhouse-header__crest">
                            <AuthCrest />
                        </div>
                        <div className="clubhouse-header__titles">
                            <h1>Tournaments</h1>
                            <span className="clubhouse-header__sub">
                                {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} on the calendar
                            </span>
                        </div>
                    </header>

                    <div className="tournaments-toolbar">
                        <button className="btn-tournament btn-tournament--add" onClick={handleAddTournament}>
                            <span className="btn-tournament__plus">+</span> Create Tournament
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="tournaments-grid">
                            {[0, 1].map(i => <div key={i} className="tcard tcard--skeleton" />)}
                        </div>
                    ) : tournaments.length === 0 ? (
                        <div className="tournaments-empty">
                            <div className="tournaments-empty__crest"><AuthCrest /></div>
                            <h3>No tournaments yet</h3>
                            <p>Host a tournament or join one — the ones you run or play in show up here.</p>
                            <button className="btn-tournament btn-tournament--add" onClick={handleAddTournament}>
                                <span className="btn-tournament__plus">+</span> Create Tournament
                            </button>
                        </div>
                    ) : (
                        <div className="tournaments-grid">
                            {tournaments.map((t) => {
                                const players = getPlayers(t);
                                const isHost = currentUser?.id === t.creator_id;
                                const isActive = t.status === 0;
                                return (
                                    <article key={t.id} className={`tcard ${isActive ? 'tcard--active' : 'tcard--done'}`}>
                                        <div className="tcard__top">
                                            <div className="tcard__emblem">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                     strokeLinejoin="round">
                                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                                                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                                                    <path d="M4 22h16"></path>
                                                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                                                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                                                </svg>
                                            </div>
                                            <div className="tcard__heading">
                                                <h2>{t.name}</h2>
                                                {t.description && <p className="tcard__desc">{t.description}</p>}
                                            </div>
                                            <div className="tcard__top-actions">
                                                <span className={`tcard__role ${isHost ? 'is-host' : 'is-player'}`}>
                                                    {isHost ? 'Host' : 'Playing'}
                                                </span>
                                                {!isActive && (
                                                    <button
                                                        type="button"
                                                        className="tcard__export"
                                                        onClick={(e) => { e.stopPropagation(); handleExportTournament(t); }}
                                                        title="Export results to PDF"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                    </button>
                                                )}
                                                {isHost && (
                                                    <button
                                                        type="button"
                                                        className="tcard__delete"
                                                        onClick={() => setToDelete(t)}
                                                        title="Delete tournament"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="tcard__meta">
                                            {t.date && (
                                                <span className="tcard__pill">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                         strokeLinejoin="round">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    {formatDate(t.date)}
                                                </span>
                                            )}
                                            {t.course && (
                                                <span className="tcard__pill">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                         strokeLinejoin="round">
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                        <circle cx="12" cy="10" r="3"></circle>
                                                    </svg>
                                                    {t.course.name}
                                                </span>
                                            )}
                                            {t.scoring_method && (
                                                <span className="tcard__pill tcard__pill--method">{t.scoring_method.name}</span>
                                            )}
                                            {isHost && t.invite_code && (
                                                <button
                                                    type="button"
                                                    className="tcard__code"
                                                    onClick={() => copyInviteCode(t.invite_code!)}
                                                    title="Copy invite code"
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                         strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                    {t.invite_code}
                                                </button>
                                            )}
                                            <span className={`tcard__status ${isActive ? 'is-active' : 'is-done'}`}>
                                                {isActive ? 'Active' : 'Completed'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="tcard__foot"
                                            onClick={() => setStandingsFor(t)}
                                            title="View standings"
                                        >
                                            <div className="tcard__avatars">
                                                {players.slice(0, 5).map(p => (
                                                    <span key={p.id} className="tcard__avatar" title={`${p.name} ${p.surname || ''}`.trim()}>
                                                        {getInitials(p)}
                                                    </span>
                                                ))}
                                                {players.length > 5 && (
                                                    <span className="tcard__avatar tcard__avatar--more">+{players.length - 5}</span>
                                                )}
                                            </div>
                                            <div className="tcard__counts">
                                                <span><b>{players.length}</b> {players.length === 1 ? 'player' : 'players'}</span>
                                                <svg className="tcard__chevron" width="16" height="16" viewBox="0 0 24 24"
                                                     fill="none" stroke="currentColor" strokeWidth="2.5"
                                                     strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 18 15 12 9 6"></polyline>
                                                </svg>
                                            </div>
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {standingsFor && (() => {
                const t = standingsFor;
                const showPoints = awardsPoints(t);
                const showNet = isMedal(t);
                const totalHoles = t.course?.num_holes || 18;
                const rows = getStandings(t);
                const teamRows = getTeamStandings(t);
                // Portal to <body> so the bottom-sheet escapes the page's fixed
                // stacking context and renders above the bottom nav.
                return createPortal((
                    <div className="tp-modal-overlay" onClick={() => setStandingsFor(null)}>
                        <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="tp-modal__header">
                                <div className="tp-modal__heading">
                                    <span className="tp-modal__eyebrow">Standings</span>
                                    <h3>{t.name}</h3>
                                    <span className="tp-modal__sub">
                                        {t.scoring_method?.name}{t.course ? ` · ${t.course.name}` : ''}
                                    </span>
                                </div>
                                <button className="tp-modal__close" onClick={() => setStandingsFor(null)}>&times;</button>
                            </div>

                            <div className="tp-modal__list">
                                {isTeamStandings(t) ? (
                                    teamRows.length === 0 ? (
                                        <div className="tp-empty">No teams have teed off yet.</div>
                                    ) : teamRows.map((tm, i) => {
                                        const started = tm.holes_played > 0;
                                        const pct = Math.min(100, Math.round((tm.holes_played / totalHoles) * 100));
                                        const key = teamKey(tm);
                                        const open = expandedAlliance === key;
                                        return (
                                            <div key={key} className={`tp-alliance ${open ? 'is-open' : ''}`}>
                                                <button
                                                    type="button"
                                                    className={`tp-row tp-row--alliance ${started ? '' : 'tp-row--idle'}`}
                                                    onClick={() => setExpandedAlliance(open ? null : key)}
                                                >
                                                    <span className="tp-row__rank">{started ? i + 1 : '–'}</span>
                                                    <div className="tp-alliance__avatars">
                                                        {tm.players.slice(0, 4).map(p => (
                                                            <span key={p.id} className="tp-row__avatar">{getInitials(p)}</span>
                                                        ))}
                                                    </div>
                                                    <div className="tp-row__main">
                                                        <div className="tp-row__name">
                                                            <span className="tp-row__player">{teamLabel(tm)}</span>
                                                        </div>
                                                        {started ? (
                                                            <div className="tp-row__progress">
                                                                <div className="tp-row__bar"><span style={{width: `${pct}%`}} /></div>
                                                                <span className="tp-row__thru">{tm.holes_played}/{totalHoles}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="tp-row__idle-label">Yet to tee off</div>
                                                        )}
                                                    </div>
                                                    <div className="tp-row__stats">
                                                        <div className="tp-stat tp-stat--points">
                                                            <b>{started ? tm.total : '–'}</b>
                                                            <i>Total</i>
                                                        </div>
                                                    </div>
                                                </button>
                                                {open && (
                                                    <div className="tp-alliance__members">
                                                        {tm.players.map(p => {
                                                            const pStarted = p.holes_played > 0;
                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    className={`tp-alliance__member ${pStarted ? 'tp-alliance__member--tappable' : ''}`}
                                                                    onClick={pStarted ? () => openScorecard(t, p.id, `${p.name} ${p.surname || ''}`.trim()) : undefined}
                                                                    role={pStarted ? 'button' : undefined}
                                                                >
                                                                    <span className="tp-alliance__member-name">{p.name} {p.surname || ''}</span>
                                                                    <span className="tp-alliance__member-pts">{pStarted ? `${p.points} pts` : '–'}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : rows.map((p, i) => {
                                    const started = p.holes_played > 0;
                                    const pct = Math.min(100, Math.round((p.holes_played / totalHoles) * 100));
                                    return (
                                        <div
                                            key={p.id}
                                            className={`tp-row ${started ? 'tp-row--tappable' : 'tp-row--idle'}`}
                                            onClick={started ? () => openScorecard(t, p.id, `${p.name} ${p.surname || ''}`.trim()) : undefined}
                                            role={started ? 'button' : undefined}
                                        >
                                            <span className="tp-row__rank">{started ? i + 1 : '–'}</span>
                                            <span className="tp-row__avatar">{getInitials(p)}</span>
                                            <div className="tp-row__main">
                                                <div className="tp-row__name">
                                                    <span className="tp-row__player">{p.name} {p.surname || ''}</span>
                                                    <span className="tp-row__hcp">HCP {p.handicap}</span>
                                                </div>
                                                {started ? (
                                                    <div className="tp-row__progress">
                                                        <div className="tp-row__bar"><span style={{width: `${pct}%`}} /></div>
                                                        <span className="tp-row__thru">{p.holes_played}/{totalHoles}</span>
                                                    </div>
                                                ) : (
                                                    <div className="tp-row__idle-label">Yet to tee off</div>
                                                )}
                                            </div>
                                            <div className="tp-row__stats">
                                                <div className="tp-stat">
                                                    <b>{started ? p.strokes : '–'}</b>
                                                    <i>Shots</i>
                                                </div>
                                                {showNet && (
                                                    <div className="tp-stat tp-stat--points">
                                                        <b>{started ? playerNet(p) : '–'}</b>
                                                        <i>Net</i>
                                                    </div>
                                                )}
                                                {showPoints && (
                                                    <div className="tp-stat tp-stat--points">
                                                        <b>{started ? p.points : '–'}</b>
                                                        <i>Pts</i>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ), document.body);
            })()}

            {scorecardLoading && !scorecard && createPortal((
                <div className="tp-modal-overlay">
                    <div className="sc-loading">Loading scorecard…</div>
                </div>
            ), document.body)}

            {scorecard && (() => {
                const {round, playerId, playerName} = scorecard;
                const holes = [...round.course.holes].sort((a, b) => a.hole_number - b.hole_number);
                const mid = round.scoring_method.id;
                const usesPoints = mid !== 1 && mid !== 7;
                const isMedalM = mid === 7;
                const isStrokeM = mid === 1;
                const player = round.players.find(p => p.id === playerId);
                const hcp = player?.handicap ?? 0;
                const psFor = (h: number) =>
                    round.scores.find(s => s.holeNumber === h)?.playerScores.find(x => x.playerId === playerId);

                const playedHoles = holes.filter(h => (psFor(h.hole_number)?.strokes ?? 0) > 0);
                const totalStrokes = playedHoles.reduce((s, h) => s + (psFor(h.hole_number)?.strokes || 0), 0);
                const totalPoints = playedHoles.reduce((s, h) => s + (psFor(h.hole_number)?.points || 0), 0);
                const scoredPar = playedHoles.reduce((s, h) => s + h.hole_par, 0);
                const toPar = totalStrokes - scoredPar;
                const toParLabel = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`;

                const shotClass = (strokes: number | undefined, par: number) => {
                    if (!strokes) return '';
                    if (strokes < par) return 'sc-cell--under';
                    if (strokes > par) return 'sc-cell--over';
                    return '';
                };

                const nine = (start: number, end: number, label: string) => {
                    const ns = holes.filter(h => h.hole_number >= start && h.hole_number <= end);
                    let parTot = 0, strTot = 0, ptsTot = 0;
                    ns.forEach(h => {
                        parTot += h.hole_par;
                        const ps = psFor(h.hole_number);
                        strTot += ps?.strokes || 0;
                        ptsTot += ps?.points || 0;
                    });
                    return (
                        <div className="sc-table-wrap" key={label}>
                            <table className="sc-table">
                                <thead>
                                    <tr>
                                        <th className="sc-rowhead">{label}</th>
                                        {ns.map(h => <th key={h.hole_number}>{h.hole_number}</th>)}
                                        <th className="sc-total">{start === 1 ? 'Out' : 'In'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="sc-par">
                                        <td className="sc-rowhead">Par</td>
                                        {ns.map(h => <td key={h.hole_number}>{h.hole_par}</td>)}
                                        <td className="sc-total">{parTot}</td>
                                    </tr>
                                    <tr className="sc-si">
                                        <td className="sc-rowhead">SI</td>
                                        {ns.map(h => <td key={h.hole_number}>{h.hole_stroke}</td>)}
                                        <td className="sc-total">–</td>
                                    </tr>
                                    <tr className="sc-shots">
                                        <td className="sc-rowhead">Shots</td>
                                        {ns.map(h => {
                                            const ps = psFor(h.hole_number);
                                            return <td key={h.hole_number} className={shotClass(ps?.strokes, h.hole_par)}>{ps?.strokes ? ps.strokes : '–'}</td>;
                                        })}
                                        <td className="sc-total">{strTot || '–'}</td>
                                    </tr>
                                    {usesPoints && (
                                        <tr className="sc-pts">
                                            <td className="sc-rowhead">Pts</td>
                                            {ns.map(h => {
                                                const ps = psFor(h.hole_number);
                                                return <td key={h.hole_number}>{ps?.strokes ? ps.points : '–'}</td>;
                                            })}
                                            <td className="sc-total">{ptsTot}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    );
                };

                return createPortal((
                    <div className="tp-modal-overlay" onClick={() => setScorecard(null)}>
                        <div className="tp-modal tp-modal--scorecard" onClick={(e) => e.stopPropagation()}>
                            <div className="tp-modal__header">
                                <div className="tp-modal__heading">
                                    <span className="tp-modal__eyebrow">Scorecard · read-only</span>
                                    <h3>{playerName}</h3>
                                    <span className="tp-modal__sub">
                                        HCP {hcp} · {round.scoring_method.name} · {round.course.name}
                                    </span>
                                </div>
                                <button className="tp-modal__close" onClick={() => setScorecard(null)}>&times;</button>
                            </div>

                            <div className="sc-totals">
                                <div className="tp-stat"><b>{totalStrokes || '–'}</b><i>Shots</i></div>
                                {isStrokeM && <div className="tp-stat tp-stat--points"><b>{playedHoles.length ? toParLabel : '–'}</b><i>To Par</i></div>}
                                {isMedalM && <div className="tp-stat tp-stat--points"><b>{playedHoles.length ? totalStrokes - hcp : '–'}</b><i>Net</i></div>}
                                {usesPoints && <div className="tp-stat tp-stat--points"><b>{totalPoints}</b><i>Points</i></div>}
                            </div>

                            <div className="tp-modal__list sc-body">
                                {playedHoles.length === 0 ? (
                                    <div className="tp-empty">No holes scored yet.</div>
                                ) : (
                                    <>
                                        {nine(1, 9, 'Front 9')}
                                        {nine(10, 18, 'Back 9')}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ), document.body);
            })()}

            {showCreate && (
                <CreateTournamentModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleTournamentCreated}
                />
            )}

            <ConfirmDialog
                isOpen={!!toDelete}
                title="Delete Tournament"
                message={`Are you sure you want to delete "${toDelete?.name}"? This removes the tournament for everyone. The individual rounds will remain.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setToDelete(null)}
            />
        </div>
    );
};

export default Tournament;
