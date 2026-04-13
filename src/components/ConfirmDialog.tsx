import "../styles/Components/confirm-dialog.scss"

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger'
}: ConfirmDialogProps) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return '⚠️';
            case 'warning':
                return '⚡';
            case 'info':
                return 'ℹ️';
            default:
                return '⚠️';
        }
    };

    return (
        <div className="confirm-dialog-overlay">
            <div className={`confirm-dialog ${variant}`}>
                <div className="confirm-dialog-header">
                    <div className="confirm-icon">{getIcon()}</div>
                    <h3>{title}</h3>
                </div>
                <div className="confirm-dialog-body">
                    <p>{message}</p>
                </div>
                <div className="confirm-dialog-actions">
                    <button 
                        className="btn-cancel" 
                        onClick={onCancel}
                        type="button"
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={`btn-confirm ${variant}`} 
                        onClick={onConfirm}
                        type="button"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
