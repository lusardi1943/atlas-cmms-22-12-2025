import {
  Box,
  debounce,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import CustomDataGrid from '../components/CustomDatagrid';
import {
  GridActionsCellItem,
  GridEnrichedColDef,
  GridRenderCellParams,
  GridRowParams,
  GridToolbar,
  GridValueGetterParams
} from '@mui/x-data-grid';
import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import UserDetailsDrawer from './UserDetailsDrawer';
import User from '../../../models/owns/user';
import { useParams } from 'react-router-dom';
import { isNumeric } from 'src/utils/validators';
import { useDispatch, useSelector } from '../../../store';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import {
  clearSingleUser,
  disableUser,
  editUser,
  editUserRole,
  enableUser,
  getSingleUser,
  getUsers,
  deleteUser
} from '../../../slices/user';
import { OwnUser } from '../../../models/user';
import { PermissionEntity, Role } from '../../../models/owns/role';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import useAuth from '../../../hooks/useAuth';
import Form from '../components/form';
import * as Yup from 'yup';
import { IField } from '../type';
import { formatSelect } from '../../../utils/formatters';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { FilterField, SearchCriteria, SortDirection } from '../../../models/owns/page';
import { onSearchQueryChange } from '../../../utils/overall';
import SearchInput from '../components/SearchInput';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ConfirmDialog from '../components/ConfirmDialog';
import { useGridApiRef } from '@mui/x-data-grid-pro';
import useGridStatePersist from '../../../hooks/useGridStatePersist';
import InviteUserDialog from './components/InviteUserDialog';
import DeactivateUserDialog from './components/DeactivateUserDialog';
import { isEmailVerificationEnabled } from '../../../config';

interface PropsType {
  values?: any;
  openModal: boolean;
  handleCloseModal: () => void;
}

const People = ({ openModal, handleCloseModal }: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const [currentUser, setCurrentUser] = useState<OwnUser>();
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const { peopleId } = useParams();
  const { hasEditPermission, user } = useAuth();
  const { users, loadingGet, singleUser } = useSelector((state) => state.users);
  const [openDrawerFromUrl, setOpenDrawerFromUrl] = useState<boolean>(false);
  const [showDisabled, setShowDisabled] = useState<boolean>(false);
  const initialFilter: FilterField | undefined = useMemo(() => {
    return {
      field: 'enabled',
      value: !showDisabled,
      operation: 'eq'
    };
  }, [showDisabled]);

  // Sincroniza el filtro de usuarios (habilitados/deshabilitados) con la selección de la UI
  useEffect(() => {
    setCriteria((prev) => ({
      ...prev,
      filterFields: [initialFilter]
    }));
  }, [initialFilter]);

  const [criteria, setCriteria] = useState<SearchCriteria>({
    filterFields: [initialFilter],
    pageSize: 10,
    pageNum: 0,
    direction: 'DESC'
  });
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedCurrency, getFormattedDate } = useContext(
    CompanySettingsContext
  );
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDisableModal, setOpenDisableModal] = useState<boolean>(false);
  const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false);

  const onQueryChange = (event) => {
    onSearchQueryChange<User>(event, criteria, setCriteria, [
      'firstName',
      'lastName',
      'email',
      'phone',
      'jobTitle'
    ]);
  };
  const debouncedQueryChange = useMemo(() => debounce(onQueryChange, 1300), []);

  const onEditSuccess = () => {
    setOpenUpdateModal(false);
    showSnackBar(t('changes_saved_success'), 'success');
  };
  const onEditFailure = (err) =>
    showSnackBar(t("The User couldn't be edited"), 'error');

  const handleOpenDrawer = (user: OwnUser) => {
    setCurrentUser(user);
    window.history.replaceState(
      null,
      'User details',
      `/app/people-teams/people/${user.id}`
    );
    setDetailDrawerOpen(true);
  };
  const handleOpenDetails = (id: number) => {
    const foundUser = users.content.find((user) => user.id === id);
    if (foundUser) {
      handleOpenDrawer(foundUser);
    }
  };
  const handleOpenUpdate = (id: number) => {
    const foundUser = users.content.find((user) => user.id === id);
    if (foundUser) {
      setCurrentUser(foundUser);
      setOpenUpdateModal(true);
    }
  };
  const handleOpenDisable = (id: number) => {
    const foundUser = users.content.find((user) => user.id === id);
    if (foundUser) {
      setCurrentUser(foundUser);
      setOpenDisableModal(true);
    }
  };
  const handleOpenDelete = (id: number) => {
    const foundUser = users.content.find((user) => user.id === id);
    if (foundUser) {
      setCurrentUser(foundUser);
      setOpenDeleteModal(true);
    }
  };
  const handleCloseDetails = () => {
    window.history.replaceState(null, 'User', `/app/people-teams/people`);
    setDetailDrawerOpen(false);
  };
  const defautfields: Array<IField> = [
    {
      name: 'firstName',
      type: 'text',
      label: t('first_name')
    },
    {
      name: 'lastName',
      type: 'text',
      label: t('last_name')
    },
    {
      name: 'email',
      type: 'text',
      label: t('email')
    },
    {
      name: 'rate',
      type: 'number',
      label: t('hourly_rate')
    },
    {
      name: 'role',
      type: 'select',
      type2: 'role',
      label: t('role')
    },
    {
      name: 'password',
      type: 'text',
      label: t('password_leave_empty_if_you_dont_want_to_change')
    }
  ];
  const getFields = () => {
    let fields = [...defautfields];
    const canEditOthers = user?.role?.editOtherPermissions?.includes(
      PermissionEntity.PEOPLE_AND_TEAMS
    );
    // Hide 'role' for owners or self
    if (currentUser?.ownsCompany || currentUser?.id === user?.id) {
      fields = fields.filter((field) => field.name !== 'role');
    }
    // Hide password if NOT an admin
    if (!canEditOthers) {
      fields = fields.filter((field) => field.name !== 'password');
    }
    return fields;
  };
  const renderEditUserModal = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={openUpdateModal}
      onClose={() => setOpenUpdateModal(false)}
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('edit_user')}
        </Typography>
        <Typography variant="subtitle2">
          {t('edit_user_description')}
        </Typography>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 3
        }}
      >
        <Box>
          <Form
            fields={getFields()}
            validation={Yup.object().shape({
              email: Yup.string()
                .email(t('invalid_email'))
                .required(t('required_email')),
              password: Yup.string().min(8, t('invalid_password')).nullable()
            })}
            submitText={t('save')}
            values={{
              email: currentUser?.email,
              rate: currentUser?.rate,
              role: currentUser
                ? {
                  label:
                    currentUser.role.code === 'USER_CREATED'
                      ? currentUser.role.name
                      : t(`${currentUser.role.code}_name`),
                  value: currentUser.role.id
                }
                : null,
              password: null
            }}
            onChange={({ field, e }) => { }}
            onSubmit={async (values) => {
              return dispatch(
                editUser(currentUser.id, {
                  ...currentUser,
                  email: values.email,
                  rate: values.rate ?? currentUser.rate,
                  newPassword: values.password ?? null
                })
              )
                .then(
                  () =>
                    formatSelect(values.role).id !== currentUser.role.id &&
                    dispatch(
                      editUserRole(currentUser.id, formatSelect(values.role).id)
                    )
                )
                .then(onEditSuccess)
                .catch(onEditFailure);
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
  // if reload with peopleId
  useEffect(() => {
    if (peopleId && isNumeric(peopleId)) {
      dispatch(getSingleUser(Number(peopleId)));
    }
  }, [peopleId]);

  useEffect(() => {
    dispatch(getUsers(criteria));
  }, [criteria]);

  //see changes in ui on edit
  useEffect(() => {
    if (singleUser || users.content.length) {
      const currentInContent = users.content.find(
        (user) => user.id === currentUser?.id
      );
      const updatedUser = currentInContent ?? singleUser;
      if (updatedUser) {
        if (openDrawerFromUrl) {
          setCurrentUser(updatedUser);
        } else {
          handleOpenDrawer(updatedUser);
          setOpenDrawerFromUrl(true);
        }
      }
    }
    return () => {
      dispatch(clearSingleUser());
    };
  }, [singleUser, users]);

  const onPageSizeChange = (size: number) => {
    setCriteria({ ...criteria, pageSize: size });
  };
  const onPageChange = (number: number) => {
    setCriteria({ ...criteria, pageNum: number });
  };

  // let fields: Array<IField> = [];

  // const shape = {};

  const columns: GridEnrichedColDef[] = [
    {
      field: 'name',
      headerName: t('name'),
      width: 150,
      valueGetter: (params) => `${params.row.firstName} ${params.row.lastName}`,
      renderCell: (params: GridRenderCellParams<string>) => (
        <Box sx={{ fontWeight: 'bold' }}>{params.value}</Box>
      )
    },
    {
      field: 'email',
      headerName: t('email'),
      width: 150
    },
    {
      field: 'phone',
      headerName: t('phone'),
      width: 150
    },
    {
      field: 'jobTitle',
      headerName: t('job_title'),
      width: 150
    },
    {
      field: 'role',
      headerName: t('role'),
      width: 150,
      valueGetter: (params: GridValueGetterParams<Role>) =>
        params.value.code === 'USER_CREATED'
          ? params.value.name
          : t(`${params.value.code}_name`)
    },
    {
      field: 'rate',
      headerName: t('hourly_rate'),
      width: 150,
      valueGetter: (params: GridValueGetterParams<number>) =>
        getFormattedCurrency(params.value)
    },
    {
      field: 'lastLogin',
      headerName: t('last_login'),
      width: 150,
      valueGetter: (params: GridValueGetterParams<string>) =>
        getFormattedDate(params.value)
    },
    {
      field: 'deactivatedUntil',
      headerName: t('deactivated_until'),
      width: 150,
      valueGetter: (params: GridValueGetterParams<string>) =>
        params.value ? getFormattedDate(params.value) : '-'
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('actions'),
      description: t('actions'),
      getActions: (params: GridRowParams<OwnUser>) => {
        // Verifica si el usuario actual tiene permisos para editar personas y equipos
        if (!hasEditPermission(PermissionEntity.PEOPLE_AND_TEAMS, params.row))
          return [];
        let actions = [
          <GridActionsCellItem
            key="edit"
            icon={<EditTwoToneIcon fontSize="small" color={'primary'} />}
            onClick={() => handleOpenUpdate(Number(params.id))}
            label={t('edit')}
            showInMenu={false}
          />
        ];

        // No permitir habilitar/deshabilitar/eliminar al dueño de la compañía
        if (!params.row.ownsCompany) {
          if (params.row.enabled) {
            // Acción para deshabilitar usuario activo
            actions.push(
              <GridActionsCellItem
                key="disable"
                icon={<CancelIcon fontSize="small" color={'error'} />}
                onClick={() => handleOpenDisable(Number(params.id))}
                label={t('disable')}
                showInMenu={false}
              />
            );
          } else {
            // Acción para habilitar usuario inactivo (reactivación)
            actions.push(
              <GridActionsCellItem
                key="enable"
                icon={<CheckCircleIcon fontSize="small" color={'success'} />}
                onClick={() => {
                  dispatch(enableUser(Number(params.id))).then(() =>
                    showSnackBar(t('user_enabled_success'), 'success')
                  );
                }}
                label={t('enable')}
                showInMenu={false}
              />
            );
          }
          // Acción para eliminar usuario (soft-delete)
          actions.push(
            <GridActionsCellItem
              key="delete"
              icon={<DeleteTwoToneIcon fontSize="small" color={'error'} />}
              onClick={() => handleOpenDelete(Number(params.id))}
              label={t('delete')}
              showInMenu={false}
            />
          );
        }

        return actions;
      }
    }
  ];
  const apiRef = useGridApiRef();
  useGridStatePersist(apiRef, columns, 'users');
  const RenderPeopleList = () => (
    <CustomDataGrid
      apiRef={apiRef}
      pageSize={criteria.pageSize}
      page={criteria.pageNum}
      rows={users.content}
      rowCount={users.totalElements}
      pagination
      paginationMode="server"
      sortingMode="server"
      onPageSizeChange={onPageSizeChange}
      onPageChange={onPageChange}
      rowsPerPageOptions={[10, 20, 50]}
      loading={loadingGet}
      onSortModelChange={(model) => {
        if (model.length === 0) {
          setCriteria({
            ...criteria,
            sortField: undefined,
            direction: undefined
          });
          return;
        }

        const fieldMapping = {
          firstName: 'firstName',
          lastName: 'lastName',
          email: 'email',
          rate: 'rate',
          role: 'role.name'
        };

        const field = model[0].field;
        const mappedField = fieldMapping[field];

        if (!mappedField) return;

        setCriteria({
          ...criteria,
          sortField: mappedField,
          direction: (model[0].sort?.toUpperCase() || 'ASC') as SortDirection
        });
      }}
      columns={columns}
      components={{
        Toolbar: GridToolbar
      }}
      initialState={{
        columns: {
          columnVisibilityModel: {}
        }
      }}
      onRowClick={(params) => {
        // setCurrentUser(users.find((user) => user.id === params.id));
        handleOpenDetails(Number(params.id));
      }}
    />
  );

  return (
    <Box
      sx={{
        p: 2
      }}
    >
      <Stack direction="row" width="95%" justifyContent="space-between" alignItems="center">
        <Box sx={{ my: 0.5, flexGrow: 1 }}>
          <SearchInput onChange={debouncedQueryChange} />
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
            />
          }
          label={t('view_disabled_users')}
        />
      </Stack>
      {RenderPeopleList()}

      <Drawer
        variant="temporary"
        anchor={theme.direction === 'rtl' ? 'left' : 'right'}
        open={detailDrawerOpen}
        onClose={handleCloseDetails}
        elevation={9}
      >
        <UserDetailsDrawer user={currentUser} />
      </Drawer>

      <InviteUserDialog
        open={openModal}
        onClose={handleCloseModal}
        onRefreshUsers={() => {
          dispatch(getUsers(criteria));
        }}
      />
      {currentUser && (
        <DeactivateUserDialog
          open={openDisableModal}
          onClose={() => setOpenDisableModal(false)}
          userName={`${currentUser.firstName} ${currentUser.lastName}`}
          onConfirm={(date) => {
            dispatch(disableUser(currentUser.id, date)).then(() => {
              setOpenDisableModal(false);
              showSnackBar(t('user_disabled_success'), 'success');
            });
          }}
        />
      )}
      <ConfirmDialog
        open={openDeleteModal}
        onCancel={() => {
          setOpenDeleteModal(false);
        }}
        onConfirm={() => {
          if (currentUser) {
            dispatch(deleteUser(currentUser.id)).then(() => {
              setOpenDeleteModal(false);
              showSnackBar(t('user_deleted_success'), 'success');
            });
          }
        }}
        confirmText={t('delete')}
        question={t('confirm_delete_user', {
          user: `${currentUser?.firstName} ${currentUser?.lastName}`
        })}
      />
      {renderEditUserModal()}
    </Box>
  );
};

export default People;
