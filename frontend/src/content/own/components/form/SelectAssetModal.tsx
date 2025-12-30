import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
  List,
  ListItem,
  Collapse,
  Checkbox,
  Stack
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from '../../../../store';
import { getAssetsMini } from '../../../../slices/asset';
import { AssetMiniDTO } from '../../../../models/owns/asset';
import ReplayTwoToneIcon from '@mui/icons-material/ReplayTwoTone';
import NoRowsMessageWrapper from '../NoRowsMessageWrapper';
import { usePrevious } from '../../../../hooks/usePrevious';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, TextField } from '@mui/material';

interface SelectAssetModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (assets: AssetMiniDTO[]) => void;
  excludedAssetIds?: number[];
  locationId?: number;
  maxSelections?: number;
  initialSelectedAssets?: AssetMiniDTO[];
}

interface AssetTreeNode extends AssetMiniDTO {
  children: AssetTreeNode[];
}

interface RecursiveAssetSelectionItemProps {
  node: AssetTreeNode;
  depth?: number;
  isSelected: (id: number) => boolean;
  onToggle: (node: AssetTreeNode) => void;
  single: boolean;
}

/**
 * Componente recursivo para renderizar cada nodo del árbol de activos.
 * Cambio: Movido fuera del componente principal para evitar pérdida de estado en re-renders.
 * Impacto: Mejora la estabilidad del estado 'expanded' y el rendimiento general.
 */
const RecursiveAssetSelectionItem: React.FC<RecursiveAssetSelectionItemProps> = ({
  node,
  depth = 0,
  isSelected,
  onToggle,
  single
}) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const hasChildren = node.children && node.children.length > 0;
  const selected = isSelected(node.id);

  return (
    <Box>
      <ListItem
        disablePadding
        sx={{
          py: 0.5,
          pl: depth * 4, // Cambio: depth * 2 → depth * 4 para coincidir con LocationDetails. Impacto: Jerarquía visual clara.
          display: 'flex',
          alignItems: 'center',
          '&:hover': { backgroundColor: theme.colors.alpha.black[5] }
        }}
      >
        <Box sx={{ width: 32, display: 'flex', justifyContent: 'center' }}>
          {hasChildren && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>
        {!single && (
          <Checkbox
            size="small"
            checked={selected}
            onChange={() => onToggle(node)}
            sx={{ p: 0.5, mr: 1 }}
          />
        )}
        <Box
          sx={{ cursor: 'pointer', flex: 1, py: 1 }}
          onClick={() => onToggle(node)}
        >
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
          <Typography
            variant="subtitle2"
            color="textSecondary"
            sx={{ fontSize: '0.7rem' }}
          >
            ID: {node.customId}
          </Typography>
        </Box>
      </ListItem>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((child) => (
              <RecursiveAssetSelectionItem
                key={child.id}
                node={child}
                depth={depth + 1}
                isSelected={isSelected}
                onToggle={onToggle}
                single={single}
              />
            ))}
          </List>
        </Collapse>
      )}
    </Box>
  );
};

const SelectAssetModal: React.FC<SelectAssetModalProps> = ({
  open,
  onClose,
  onSelect,
  excludedAssetIds = [],
  locationId,
  maxSelections,
  initialSelectedAssets = []
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { loadingGet, assetsMini } = useSelector((state) => state.assets);
  const single = maxSelections === 1;

  const [selectedAssets, setSelectedAssets] = useState<AssetMiniDTO[]>(
    initialSelectedAssets
  );
  const [query, setQuery] = useState('');
  const lastFetchedLocationId = useRef<number | undefined>(undefined);
  const previousInitialSelectedAssets = usePrevious(initialSelectedAssets);

  const handleReset = (callApi: boolean, locId?: number) => {
    if (callApi) {
      dispatch(getAssetsMini(locId));
      lastFetchedLocationId.current = locId;
    }
  };

  useEffect(() => {
    if (open) {
      // Fetch if never fetched OR if locationId changed
      if (lastFetchedLocationId.current !== locationId) {
        handleReset(true, locationId);
      }

      // Update local selection if initial assets changed
      if (
        JSON.stringify(previousInitialSelectedAssets) !==
        JSON.stringify(initialSelectedAssets)
      ) {
        setSelectedAssets(initialSelectedAssets || []);
      }
    }
  }, [open, initialSelectedAssets, previousInitialSelectedAssets, locationId]);

  useEffect(() => {
    if (single && open) {
      setSelectedAssets([]);
    }
  }, [open, single]);

  const onToggleSelection = (asset: AssetMiniDTO) => {
    const isAlreadySelected = selectedAssets.some((item) => item.id === asset.id);
    if (isAlreadySelected) {
      setSelectedAssets(selectedAssets.filter((item) => item.id !== asset.id));
    } else {
      if (single) {
        onSelect([asset]);
        onClose();
      } else {
        if (!maxSelections || selectedAssets.length < maxSelections) {
          setSelectedAssets([...selectedAssets, asset]);
        }
      }
    }
  };

  const handleConfirmSelection = () => {
    onSelect(selectedAssets);
    onClose();
  };

  /**
   * Construye el árbol de activos preservando la jerarquía completa.
   * Cambio: Implementado algoritmo de preservación de ancestros (path-preserving).
   * Impacto: Evita nodos huérfanos al filtrar, manteniendo padres visibles para contexto.
   */
  const mapAssetsToTree = (assets: AssetMiniDTO[]): AssetTreeNode[] => {
    const assetMap = new Map<number, AssetTreeNode>();
    const allAssetMap = new Map<number, AssetMiniDTO>();

    // Map all available assets for path lookup
    assets.forEach(asset => allAssetMap.set(Number(asset.id), asset));

    // Determine which assets should be visible (matches query AND matches location if applicable)
    // Actually, for location, the backend already filters. 
    // But for query, we want to keep parents of matches.
    const matchedAssets = assets.filter(asset => {
      const matchesSearch = !query ||
        asset.name.toLowerCase().includes(query.toLowerCase()) ||
        asset.customId.toLowerCase().includes(query.toLowerCase());
      const isNotExcluded = !excludedAssetIds.includes(asset.id);
      return matchesSearch && isNotExcluded;
    });

    const visibleIds = new Set<number>();

    // For each matched asset, include it and all its ancestors
    matchedAssets.forEach(asset => {
      let current: AssetMiniDTO | undefined = asset;
      while (current) {
        visibleIds.add(Number(current.id));
        current = current.parentId ? allAssetMap.get(Number(current.parentId)) : undefined;
      }
    });

    const roots: AssetTreeNode[] = [];

    // Build the tree only using visible items
    // First, populate the map with copies
    visibleIds.forEach(id => {
      const asset = allAssetMap.get(id);
      if (asset) {
        assetMap.set(id, { ...asset, children: [] });
      }
    });

    // Link them
    visibleIds.forEach(id => {
      const node = assetMap.get(id);
      if (node) {
        const pId = node.parentId ? Number(node.parentId) : null;
        if (pId && assetMap.has(pId)) {
          assetMap.get(pId).children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    // Sort alphabetically? Optional.
    const sortNodes = (nodes: AssetTreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
  };

  const assetTree = useMemo(() => mapAssetsToTree(assetsMini), [
    assetsMini,
    excludedAssetIds,
    query
  ]);

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="h4">{t('select_asset')}</Typography>
        <IconButton
          onClick={() => handleReset(true, locationId)}
          color="primary"
          size="small"
        >
          <ReplayTwoToneIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('search_asset')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {selectedAssets.length > 0 && !single && (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedAssets.map((asset) => (
            <Chip
              key={asset.id}
              label={`${asset.customId}: ${asset.name}`}
              onDelete={() => onToggleSelection(asset)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}

      <DialogContent dividers sx={{ p: 0, height: '60vh' }}>
        {assetTree.length === 0 && !loadingGet ? (
          <NoRowsMessageWrapper message={t('noRows.asset.message')} action="" />
        ) : (
          <List sx={{ py: 0 }}>
            {assetTree.map((node) => (
              <RecursiveAssetSelectionItem
                key={node.id}
                node={node}
                isSelected={(id) => selectedAssets.some((a) => a.id === id)}
                onToggle={onToggleSelection}
                single={single}
              />
            ))}
          </List>
        )}
      </DialogContent>
      {!single && (
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} color="secondary">
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirmSelection}
            color="primary"
            variant="contained"
            disabled={selectedAssets.length === 0}
          >
            {t('select')} ({selectedAssets.length})
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default SelectAssetModal;
