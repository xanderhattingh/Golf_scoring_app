import {Geolocation} from '@capacitor/geolocation';
import {Capacitor} from '@capacitor/core';

export interface Coords {
    lat: number;
    lng: number;
}

/**
 * Get the user's current coordinates, cross-platform.
 *
 * - Native (iOS/Android): uses the Capacitor Geolocation plugin and requests
 *   permission first (the WebView's navigator.geolocation alone is denied).
 * - Web: the plugin delegates to navigator.geolocation.
 *
 * Never throws — returns null if permission is denied, location is unavailable
 * (e.g. desktop kCLErrorLocationUnknown), or it times out, so callers can fall back.
 */
export async function getCurrentCoords(): Promise<Coords | null> {
    try {
        if (Capacitor.isNativePlatform()) {
            let perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
                perm = await Geolocation.requestPermissions();
            }
            if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
                return null;
            }
        }

        const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false, // coarse is plenty for "nearest courses"
            timeout: 10000,
            maximumAge: 300000,        // accept a fix up to 5 min old
        });

        return {lat: pos.coords.latitude, lng: pos.coords.longitude};
    } catch {
        // denied / unavailable / timeout — caller falls back to a non-located list
        return null;
    }
}
