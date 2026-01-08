import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from '../../../store';
import useAuth from '../../../hooks/useAuth';
import { useContext } from 'react';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { IField } from '../type';
import * as Yup from 'yup';
import Form from '../components/form';
import { assetStatuses } from '../../../models/owns/asset';
import {
    fireGa4Event,
    getImageAndFiles
} from '../../../utils/overall';
import {
    formatSelect,
    formatSelectMultiple
} from '../../../utils/formatters';
import { addWorkOrder } from '../../../slices/workOrder';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';

interface WorkOrderAddModalProps {
    open: boolean;
    onClose: () => void;
    initialValues?: {
        asset?: { label: string; value: number };
        location?: { label: string; value: number };
        dueDate?: Date;
    };
    onSuccess?: () => void;
}

const WorkOrderAddModal = ({
    open,
    onClose,
    initialValues,
    onSuccess
}: WorkOrderAddModalProps) => {
    const { t }: { t: any } = useTranslation();
    const dispatch = useDispatch();
    const { getFilteredFields } = useAuth();
    const { uploadFiles, getWOFieldsAndShapes } = useContext(
        CompanySettingsContext
    );
    const { showSnackBar } = useContext(CustomSnackBarContext);
    const { workOrders } = useSelector((state) => state.workOrders);

    const defaultFields: Array<IField> = [
        {
            name: 'title',
            type: 'text',
            label: t('title'),
            placeholder: t('wo.title_description'),
            required: true
        },
        {
            name: 'description',
            type: 'text',
            label: t('description'),
            placeholder: t('description'),
            multiple: true
        },
        {
            name: 'image',
            type: 'file',
            fileType: 'image',
            label: t('image')
        },
        {
            name: 'dueDate',
            type: 'date',
            label: t('due_date')
        },
        {
            name: 'estimatedStartDate',
            type: 'date',
            label: t('estimated_start_date')
        },
        {
            name: 'estimatedDuration',
            type: 'number',
            label: t('estimated_duration'),
            placeholder: t('hours')
        },
        {
            name: 'priority',
            type: 'select',
            label: t('priority'),
            type2: 'priority'
        },
        {
            name: 'category',
            type: 'select',
            label: t('category'),
            type2: 'category',
            category: 'work-order-categories'
        },
        {
            name: 'primaryUser',
            type: 'select',
            label: t('primary_worker'),
            type2: 'user'
        },
        {
            name: 'assignedTo',
            type: 'select',
            label: t('additional_workers'),
            type2: 'user',
            multiple: true
        },
        {
            name: 'customers',
            type: 'select',
            label: t('customers'),
            type2: 'customer',
            multiple: true
        },
        {
            name: 'team',
            type: 'select',
            type2: 'team',
            label: t('team'),
            placeholder: t('select_team')
        },
        {
            name: 'location',
            type: 'select',
            type2: 'location',
            label: t('location'),
            placeholder: t('select_location'),
            leafOnly: true
        },
        {
            name: 'asset',
            type: 'select',
            type2: 'asset',
            label: t('asset'),
            placeholder: t('select_asset'),
            relatedFields: [{ field: 'location' }]
        },
        {
            name: 'assetStatus',
            type: 'select',
            label: t('asset_status'),
            placeholder: t('select_asset_status'),
            items: assetStatuses.map((assetStatus) => ({
                label: t(assetStatus.status),
                value: assetStatus.status
            }))
        },
        {
            name: 'tasks',
            type: 'select',
            type2: 'task',
            label: t('tasks'),
            placeholder: t('select_tasks')
        },
        {
            name: 'files',
            type: 'file',
            multiple: true,
            label: t('files'),
            fileType: 'file'
        },
        {
            name: 'requiredSignature',
            type: 'switch',
            label: t('requires_signature')
        }
    ];

    const defaultShape: { [key: string]: any } = {
        title: Yup.string().required(t('required_wo_title'))
    };

    const formatValues = (values) => {
        const newValues = { ...values };
        newValues.assetStatus = newValues.assetStatus?.value ?? null;
        newValues.primaryUser = formatSelect(newValues.primaryUser);
        newValues.location = formatSelect(newValues.location);
        newValues.team = formatSelect(newValues.team);
        newValues.asset = formatSelect(newValues.asset);
        newValues.assignedTo = formatSelectMultiple(newValues.assignedTo);
        newValues.customers = formatSelectMultiple(newValues.customers);
        newValues.priority = newValues.priority ? newValues.priority.value : 'NONE';
        newValues.requiredSignature = Array.isArray(newValues.requiredSignature)
            ? newValues?.requiredSignature.includes('on')
            : newValues.requiredSignature;
        newValues.category = formatSelect(newValues.category);
        return newValues;
    };

    const [fields, shape] = getWOFieldsAndShapes(defaultFields, defaultShape);

    return (
        <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
            <DialogTitle sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {t('add_wo')}
                </Typography>
                <Typography variant="subtitle2">{t('add_wo_description')}</Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 3 }}>
                <Box>
                    <Form
                        fields={getFilteredFields(fields)}
                        validation={Yup.object().shape(shape)}
                        submitText={t('add')}
                        values={{
                            requiredSignature: false,
                            dueDate: initialValues?.dueDate ?? null,
                            asset: initialValues?.asset ?? null,
                            location: initialValues?.location ?? null
                        }}
                        onChange={({ field, e }) => { }}
                        onSubmit={async (values) => {
                            if (workOrders.totalElements === 0)
                                fireGa4Event('first_wo_creation');
                            let formattedValues = formatValues(values);
                            return new Promise<void>((resolve, rej) => {
                                uploadFiles(formattedValues.files, formattedValues.image)
                                    .then((files) => {
                                        const imageAndFiles = getImageAndFiles(files);
                                        formattedValues = {
                                            ...formattedValues,
                                            image: imageAndFiles.image,
                                            files: imageAndFiles.files
                                        };
                                        dispatch(addWorkOrder(formattedValues))
                                            .then(() => {
                                                showSnackBar(t('wo_create_success'), 'success');
                                                onSuccess?.();
                                                onClose();
                                                resolve();
                                            })
                                            .catch((err) => {
                                                showSnackBar(t('wo_create_failure'), 'error');
                                                rej();
                                            });
                                    })
                                    .catch((err) => {
                                        showSnackBar(t('wo_create_failure'), 'error');
                                        rej();
                                    });
                            });
                        }}
                    />
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default WorkOrderAddModal;
