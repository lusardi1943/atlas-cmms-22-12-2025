import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    TextField
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeactivateUserDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (date: Date | null) => void;
    userName: string;
}

const DeactivateUserDialog = ({
    open,
    onClose,
    onConfirm,
    userName
}: DeactivateUserDialogProps) => {
    const { t } = useTranslation();
    // 'indefinite' para desactivación permanente, 'date' para desactivación temporal hasta una fecha específica
    const [deactivationType, setDeactivationType] = useState<'indefinite' | 'date'>('indefinite');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Confirma la desactivación enviando la fecha si es de tipo 'date' o null si es 'indefinite'
    const handleConfirm = () => {
        onConfirm(deactivationType === 'date' ? selectedDate : null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{t('deactivate_user')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t('confirm_disable_user', { user: userName })}
                </DialogContentText>
                <FormControl component="fieldset" sx={{ mt: 2 }}>
                    <RadioGroup
                        value={deactivationType}
                        onChange={(e) => setDeactivationType(e.target.value as 'indefinite' | 'date')}
                    >
                        <FormControlLabel
                            value="indefinite"
                            control={<Radio />}
                            label={t('indefinite')}
                        />
                        <FormControlLabel
                            value="date"
                            control={<Radio />}
                            label={t('until_a_date')}
                        />
                    </RadioGroup>
                </FormControl>
                {deactivationType === 'date' && (
                    <DatePicker
                        label={t('reactivation_date')}
                        value={selectedDate}
                        onChange={(newValue) => setSelectedDate(newValue)}
                        renderInput={(params) => <TextField {...params} sx={{ mt: 2, width: '100%' }} />}
                        minDate={new Date()}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('cancel')}</Button>
                <Button onClick={handleConfirm} color="error" autoFocus disabled={deactivationType === 'date' && !selectedDate}>
                    {t('disable')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeactivateUserDialog;
