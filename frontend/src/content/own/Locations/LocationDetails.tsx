import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme
} from '@mui/material';
import Location from '../../../models/owns/location';
import { ChangeEvent, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import Form from '../components/form';
import * as Yup from 'yup';
import { IField } from '../type';
import { useDispatch, useSelector } from '../../../store';
import { getAssetsByLocation } from '../../../slices/asset';
import { useNavigate } from 'react-router-dom';
import { getWorkOrdersByLocation } from '../../../slices/workOrder';
import {
  createFloorPlan,
  deleteFloorPlan,
  getFloorPlans
} from '../../../slices/floorPlan';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { getAssetUrl } from '../../../utils/urlPaths';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import { PlanFeature } from '../../../models/owns/subscriptionPlan';
import { AssetRow } from '../../../models/owns/asset';
import { AssetDTO } from '../../../models/owns/asset';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';

interface LocationDetailsProps {
  location: Location;
  handleOpenUpdate: () => void;
  handleOpenDelete: () => void;
}
export default function LocationDetails(props: LocationDetailsProps) {
  const { location, handleOpenUpdate, handleOpenDelete } = props;
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { getFormattedDate, uploadFiles } = useContext(CompanySettingsContext);
  const [openAddFloorPlan, setOpenAddFloorPlan] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('assets');
  const { assetsByLocation } = useSelector((state) => state.assets);
  const { workOrdersByLocation } = useSelector((state) => state.workOrders);
  const { floorPlansByLocation } = useSelector((state) => state.floorPlans);
  const {
    hasEditPermission,
    hasDeletePermission,
    getFilteredFields,
    hasCreatePermission,
    hasFeature
  } = useAuth();
  const locationAssets = assetsByLocation[location.id] ?? [];
  const locationWorkOrders = workOrdersByLocation[location.id] ?? [];
  const floorPlans = floorPlansByLocation[location.id] ?? [];
  const theme = useTheme();
  const navigate = useNavigate();
  const tabs = [
    { value: 'assets', label: t('assets') },
    { value: 'files', label: t('files') },
    { value: 'workOrders', label: t('work_orders') },
    { value: 'floorPlans', label: t('floor_plans') },
    { value: 'people', label: t('people') }
  ];

  const fields: Array<IField> = [
    {
      name: 'name',
      type: 'text',
      label: t('name'),
      placeholder: t('floor_plan_name_description'),
      required: true
    },
    {
      name: 'area',
      type: 'number',
      label: t('area'),
      placeholder: t('Floor plan area in m²')
    },
    {
      name: 'image',
      type: 'file',
      fileType: 'image',
      label: 'Image',
      placeholder: t('upload_image')
    }
  ];
  const floorPlanShape = {
    name: Yup.string().required(t('required_floor_plan_name'))
  };

  /**
   * Construye la jerarquía de activos sumando el campo 'hierarchy' (array de IDs)
   * basado en la relación parentAsset.
   */
  const buildHierarchy = (assets: AssetDTO[]): AssetRow[] => {
    const assetMap = new Map<number, AssetDTO>();
    assets.forEach((asset) => assetMap.set(asset.id, asset));

    const getHierarchy = (asset: AssetDTO): number[] => {
      const path: number[] = [asset.id];
      let current = asset;
      while (current.parentAsset) {
        const parent = assetMap.get(current.parentAsset.id);
        if (parent) {
          path.unshift(parent.id);
          current = parent;
        } else {
          // Si el padre no está en la lista de esta localización, paramos
          break;
        }
      }
      return path;
    };

    return assets.map((asset) => ({
      ...asset,
      hierarchy: getHierarchy(asset)
    }));
  };

  // Interfaz proyectada para los nodos del árbol de activos
  interface AssetTreeNode extends AssetRow {
    children: AssetTreeNode[];
  }

  /**
   * Componente recursivo para renderizar la jerarquía de activos en estilo lista.
   * Proporciona un control total sobre el diseño (nombres en azul, fechas debajo, indentación).
   */
  const RecursiveAssetItem = ({
    node,
    depth = 0,
    navigate,
    getAssetUrl,
    getFormattedDate
  }: {
    node: AssetTreeNode;
    depth?: number;
    navigate: any;
    getAssetUrl: any;
    getFormattedDate: any;
    key?: any;
  }) => {
    const [open, setOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <Box key={node.id}>
        <ListItem
          disablePadding
          sx={{
            py: 0.5,
            pl: depth * 4, // Indentación visual de la jerarquía
            display: 'flex',
            alignItems: 'flex-start'
          }}
        >
          {/* Icono de expansión para navegación jerárquica */}
          <Box sx={{ width: 32, mt: 0.5 }}>
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                sx={{ p: 0.5 }}
              >
                {open ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
              </IconButton>
            )}
          </Box>
          <Box
            sx={{ cursor: 'pointer', flex: 1 }}
            onClick={() => navigate(getAssetUrl(node.id))}
          >
            {/* Nombre del activo con estilo prominente (Imagen 2) */}
            <Typography
              sx={{
                fontWeight: '600',
                fontSize: '0.9rem',
                color: theme.colors.primary.main,
                lineHeight: 1.1,
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {node.name}
            </Typography>
            {/* Fecha de creación en estilo secundario */}
            <Typography
              variant="subtitle2"
              color="textSecondary"
              sx={{ fontSize: '0.7rem', fontWeight: '400' }}
            >
              {getFormattedDate(node.createdAt)}
            </Typography>
          </Box>
        </ListItem>
        {/* Renderizado recursivo de hijos si el nivel está expandido */}
        {hasChildren && (
          <Collapse in={open} timeout="auto" unmountOnExit>
            <List disablePadding>
              {node.children.map((child) => (
                <RecursiveAssetItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  navigate={navigate}
                  getAssetUrl={getAssetUrl}
                  getFormattedDate={getFormattedDate}
                />
              ))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  useEffect(() => {
    dispatch(getAssetsByLocation(location.id));
    dispatch(getWorkOrdersByLocation(location.id));
    dispatch(getFloorPlans(location.id));
  }, [location, dispatch]);

  const assetRows = useMemo(() => buildHierarchy(locationAssets), [locationAssets]);

  /**
   * Transforma una lista plana de activos con información de jerarquía
   * en un árbol de nodos hijos para su renderizado jerárquico.
   */
  const mapAssetsToTree = (assets: AssetRow[]): AssetTreeNode[] => {
    const assetMap = new Map<number, AssetTreeNode>();
    const roots: AssetTreeNode[] = [];

    // Mapeamos todos los activos por ID
    assets.forEach((asset) => {
      assetMap.set(asset.id, { ...asset, children: [] });
    });

    // Reconstruimos la estructura padre-hijo
    assets.forEach((asset) => {
      const node = assetMap.get(asset.id);
      if (asset.parentAsset && assetMap.has(asset.parentAsset.id)) {
        assetMap.get(asset.parentAsset.id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const assetTree = useMemo(() => mapAssetsToTree(assetRows), [assetRows]);

  const renderAddFloorPlanModal = () => (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={openAddFloorPlan}
      onClose={() => setOpenAddFloorPlan(false)}
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('add_floor_plan')}
        </Typography>
        <Typography variant="subtitle2">
          {t('add_floor_plan_description')}
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
            fields={getFilteredFields(fields)}
            validation={Yup.object().shape(floorPlanShape)}
            submitText={t('add_floor_plan')}
            values={{}}
            onChange={({ field, e }) => { }}
            onSubmit={async (values) => {
              return new Promise<void>((resolve, rej) => {
                uploadFiles([], values.image)
                  .then((files) => {
                    values = {
                      ...values,
                      image: files.length ? { id: files[0].id } : null
                    };
                    dispatch(createFloorPlan(location.id, values))
                      .then(() => setOpenAddFloorPlan(false))
                      .finally(resolve);
                  })
                  .catch((err) => {
                    rej(err);
                  });
              });
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  return (
    <Grid
      container
      justifyContent="center"
      alignItems="stretch"
      spacing={2}
      padding={4}
    >
      {renderAddFloorPlanModal()}
      <Grid
        item
        xs={12}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h2">{location?.name}</Typography>
          <Typography variant="h6">{location?.address}</Typography>
        </Box>
        <Box>
          {hasEditPermission(PermissionEntity.LOCATIONS, location) && (
            <IconButton onClick={handleOpenUpdate} style={{ marginRight: 10 }}>
              <EditTwoToneIcon color="primary" />
            </IconButton>
          )}
          {hasDeletePermission(PermissionEntity.LOCATIONS, location) && (
            <IconButton onClick={handleOpenDelete}>
              <DeleteTwoToneIcon color="error" />
            </IconButton>
          )}
        </Box>
      </Grid>
      <Divider />
      {location.image && (
        <Grid
          item
          xs={12}
          lg={12}
          display="flex"
          justifyContent="center"
          padding={2}
        >
          <img
            src={location.image.url}
            style={{ borderRadius: 5, height: 200 }}
          />
        </Grid>
      )}
      <Grid item xs={12}>
        <Tabs
          onChange={handleTabsChange}
          value={currentTab}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>
      </Grid>
      <Grid item xs={12}>
        {currentTab === 'assets' && (
          <Box>
            {hasCreatePermission(PermissionEntity.ASSETS) && (
              <Box display="flex" justifyContent="right">
                <Button
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                  onClick={() =>
                    navigate(`/app/assets?location=${location.id}`)
                  }
                >
                  {t('asset')}
                </Button>
              </Box>
            )}
            {locationAssets.length ? (
              <List sx={{ width: '100%', mt: 2 }}>
                {assetTree.map((rootNode) => (
                  <RecursiveAssetItem
                    key={rootNode.id}
                    node={rootNode}
                    navigate={navigate}
                    getAssetUrl={getAssetUrl}
                    getFormattedDate={getFormattedDate}
                  />
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">
                  {t('no_asset_in_location')}
                </Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'workOrders' && (
          <Box>
            {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
              <Box display="flex" justifyContent="right">
                <Button
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                  onClick={() =>
                    navigate(`/app/work-orders?location=${location.id}`)
                  }
                >
                  {t('work_order')}
                </Button>
              </Box>
            )}
            {locationWorkOrders.length ? (
              <List sx={{ width: '100%' }}>
                {locationWorkOrders.map((workOrder) => (
                  <ListItemButton
                    key={workOrder.id}
                    divider
                    onClick={() => navigate(`/app/work-orders/${workOrder.id}`)}
                  >
                    <ListItemText
                      primary={workOrder.title}
                      secondary={getFormattedDate(workOrder.createdAt)}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">{t('no_wo_in_location')}</Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'files' && (
          <Box>
            {hasCreatePermission(PermissionEntity.FILES) &&
              hasFeature(PlanFeature.FILE) && (
                <Box display="flex" justifyContent="right">
                  <Button
                    startIcon={<AddTwoToneIcon fontSize="small" />}
                    onClick={handleOpenUpdate}
                  >
                    {t('file')}
                  </Button>
                </Box>
              )}
            {location.files.length ? (
              <List sx={{ width: '100%' }}>
                {location.files.map((file) => (
                  <ListItemButton
                    key={file.id}
                    divider
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="h6" fontWeight="bold">
                          {file.name}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">{t('no_file_in_location')}</Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'floorPlans' && (
          <Box>
            {hasEditPermission(PermissionEntity.LOCATIONS, location) && (
              <Box display="flex" justifyContent="right">
                <Button
                  onClick={() => setOpenAddFloorPlan(true)}
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                >
                  {t('floor_plan')}
                </Button>
              </Box>
            )}
            {floorPlans.length ? (
              <List sx={{ width: '100%' }}>
                {floorPlans.map((floorPlan) => (
                  <ListItemButton key={floorPlan.id} divider>
                    <ListItem
                      secondaryAction={
                        <IconButton
                          sx={{ ml: 1 }}
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  "Are you sure you want to delete this Floor Plan. It can't be undone"
                                )
                              )
                            ) {
                              dispatch(
                                deleteFloorPlan(location.id, floorPlan.id)
                              );
                            }
                          }}
                        >
                          <DeleteTwoToneIcon fontSize="small" color="error" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={floorPlan.name}
                        secondary={`${floorPlan.area} m²`}
                      />
                    </ListItem>
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">
                  {t('no_floor_plan_in_location')}
                </Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'people' && (
          <Grid container>
            {!!location.workers.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_to')}
                </Typography>
                {location.workers.map((worker, index) => (
                  <Box key={worker.id}>
                    <Link
                      href={`/app/people-teams/people/${worker.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {`${worker.firstName} ${worker.lastName}`}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.teams.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_teams')}
                </Typography>
                {location.teams.map((team, index) => (
                  <Box key={team.id}>
                    <Link
                      href={`/app/people-teams/teams/${team.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {team.name}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.customers.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_customers')}
                </Typography>
                {location.customers.map((customer, index) => (
                  <Box key={customer.id}>
                    <Link
                      href={`/app/vendors-customers/customers/${customer.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {customer.name}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.vendors.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_vendors')}
                </Typography>
                {location.vendors.map((vendor, index) => (
                  <Box key={vendor.id}>
                    <Link
                      href={`/app/vendors-customers/vendors/${vendor.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {vendor.companyName}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
