import { useRef, useEffect } from 'react';
import { useFocusTrap } from '@your-library';

const SettingsPopover = ({ isOpen, onClose }) => {
    const ref = useRef();
    const [trapRef] = useFocusTrap(isOpen);

    useEffect(() => {
        if (isOpen) {
            ref.current.focus();
        }
    }, [isOpen]);

    return (
        <div ref={trapRef} aria-modal="true" role="dialog">
            <button onClick={onClose}>Close</button>
            {/* Other popover content */}
            <button ref={ref}>Settings Action</button>
        </div>
    );
};

export default SettingsPopover;