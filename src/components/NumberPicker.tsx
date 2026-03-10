import {useState, useRef, useEffect} from 'react';
import '../styles/Components/number-picker.scss';

interface NumberPickerProps {
    value: number | undefined;
    placeholder?: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
    label?: string;
}

const NumberPicker = ({value, placeholder, min = 1, max = 15, onChange, label}: NumberPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedRef = useRef<HTMLDivElement>(null);

    const numbers = Array.from({length: max - min + 1}, (_, i) => min + i);

    useEffect(() => {
        if (isOpen && selectedRef.current) {
            selectedRef.current.scrollIntoView({block: 'center', behavior: 'instant'});
        }
    }, [isOpen]);

    const handleSelect = (num: number) => {
        onChange(num);
        setIsOpen(false);
    };

    const displayValue = value !== undefined ? value : placeholder;

    return (
        <>
            <button
                type="button"
                className="number-picker-trigger"
                onClick={() => setIsOpen(true)}
            >
                {displayValue ?? '-'}
            </button>

            {isOpen && (
                <div className="number-picker-overlay" onClick={() => setIsOpen(false)}>
                    <div className="number-picker-modal" onClick={(e) => e.stopPropagation()}>
                        {label && <div className="picker-label">{label}</div>}
                        <div className="picker-title">Select Strokes</div>
                        <div className="number-list">
                            {numbers.map(num => (
                                <div
                                    key={num}
                                    ref={num === (value ?? placeholder) ? selectedRef : null}
                                    className={`number-item ${num === value ? 'selected' : ''} ${num === placeholder && value === undefined ? 'placeholder' : ''}`}
                                    onClick={() => handleSelect(num)}
                                >
                                    {num}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="picker-cancel"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default NumberPicker;
