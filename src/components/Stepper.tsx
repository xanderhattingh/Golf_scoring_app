import {useRef, useEffect} from 'react';
import '../styles/Components/stepper.scss';

interface StepperProps {
    value: number | undefined;
    // Shown (dimmed) as the default when no value has been set yet — e.g. the hole's par.
    placeholder?: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
    ariaLabel?: string;
}

// Inline [-] value [+] stepper with press-and-hold to repeat, mirroring the
// handicap stepper on the create-round wizard. Defaults to `placeholder` until
// the user nudges it, at which point the value becomes explicit.
const Stepper = ({value, placeholder, min = 1, max = 15, onChange, ariaLabel = 'value'}: StepperProps) => {
    const displayed = value ?? placeholder ?? min;
    const isDefault = value === undefined;

    // Running value used during a hold so repeats don't read stale props between renders.
    const runningRef = useRef(displayed);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    if (!holdTimer.current) runningRef.current = displayed;

    const adjust = (delta: number) => {
        const next = Math.min(max, Math.max(min, runningRef.current + delta));
        if (next !== runningRef.current) {
            runningRef.current = next;
            onChange(next);
        }
    };

    const stopHold = () => {
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
    };

    const startHold = (delta: number) => {
        stopHold();
        runningRef.current = displayed; // start from what's on screen
        adjust(delta);                  // immediate first step
        let delay = 350;
        const tick = () => {
            adjust(delta);
            delay = Math.max(60, delay - 40); // accelerate while held
            holdTimer.current = setTimeout(tick, delay);
        };
        holdTimer.current = setTimeout(tick, delay);
        // Always stop on release, even if a button became disabled mid-hold.
        window.addEventListener('pointerup', stopHold, {once: true});
        window.addEventListener('pointercancel', stopHold, {once: true});
    };

    // Clear any running hold timer if the component unmounts mid-press.
    useEffect(() => stopHold, []);

    return (
        <div className="stepper">
            <button
                type="button"
                className="stepper__btn"
                onPointerDown={(e) => { e.preventDefault(); startHold(-1); }}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                disabled={displayed <= min}
                aria-label={`Decrease ${ariaLabel}`}
            >−</button>
            <span className={`stepper__value ${isDefault ? 'is-default' : ''}`}>{displayed}</span>
            <button
                type="button"
                className="stepper__btn"
                onPointerDown={(e) => { e.preventDefault(); startHold(1); }}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                disabled={displayed >= max}
                aria-label={`Increase ${ariaLabel}`}
            >+</button>
        </div>
    );
};

export default Stepper;
