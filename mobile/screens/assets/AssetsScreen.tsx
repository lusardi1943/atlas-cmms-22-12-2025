import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Image
} from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import {
  assetActions,
  getAssetChildren,
  getAssets,
  getMoreAssets
} from '../../slices/asset';
import { FilterField, SearchCriteria } from '../../models/page';
import { Button, Card, Searchbar, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  AssetDTO,
  AssetRow,
  assetStatuses,
  getAssetStatusConfig
} from '../../models/asset';
import {
  getNewCriteriaOnSearch,
  isCloseToBottom,
  onSearchQueryChange
} from '../../utils/overall';
import { RootStackScreenProps } from '../../types';
import Tag from '../../components/Tag';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import { IconWithLabel } from '../../components/IconWithLabel';
import { Asset } from 'expo-asset';
import { useAppTheme } from '../../custom-theme';

const AssetCard = ({
  asset,
  navigation,
  showChildrenButton = false,
  onViewChildren
}: {
  asset: AssetDTO;
  navigation: RootStackScreenProps<'Assets'>['navigation'];
  showChildrenButton?: boolean;
  onViewChildren?: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <Card
      style={{
        padding: 2,
        marginVertical: 5,
        backgroundColor: 'white'
      }}
      key={asset.id}
      onPress={() =>
        navigation.push('AssetDetails', {
          id: asset.id,
          assetProp: asset
        })
      }
    >
      <Card.Content>
        <View style={{ ...styles.row, justifyContent: 'space-between' }}>
          <View style={{ ...styles.row, justifyContent: 'space-between' }}>
            <View style={{ marginRight: 10 }}>
              <Tag
                text={`#${asset.customId}`}
                color="white"
                backgroundColor="#545454"
              />
            </View>
            <Tag
              text={t(asset?.status)}
              backgroundColor={getAssetStatusConfig(asset?.status).color(theme)}
              color="white"
            />
          </View>
        </View>
        <View style={{ ...styles.row, marginTop: 5 }}>
          <Image
            style={{ height: 70, width: 70, borderRadius: 35, marginRight: 10 }}
            source={
              asset.image
                ? {
                  uri: asset.image.url
                }
                : require('../../assets/images/no-image.png')
            }
          />
          <Text variant="titleMedium">{asset.name}</Text>
        </View>
        <View style={{ marginBottom: 10 }}>
          {asset.location && (
            <IconWithLabel
              label={asset.location.name}
              icon="map-marker-outline"
            />
          )}
        </View>
      </Card.Content>
      {showChildrenButton && asset.hasChildren && (
        <Card.Actions>
          <Button onPress={onViewChildren}>{t('view_children')}</Button>
        </Card.Actions>
      )}
    </Card>
  );
};

export default function AssetsScreen({
  navigation,
  route
}: RootStackScreenProps<'Assets'>) {
  const { t } = useTranslation();
  const [startedSearch, setStartedSearch] = useState<boolean>(false);
  const { assets, assetsHierarchy, loadingGet, currentPageNum, lastPage } =
    useSelector((state) => state.assets);
  const theme = useTheme();
  const [view, setView] = useState<'hierarchy' | 'list'>('hierarchy');
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const { hasViewPermission } = useAuth();
  const defaultFilterFields: FilterField[] = [];
  if (route.params?.locationId) {
    defaultFilterFields.push({
      field: 'location.id',
      operation: 'eq',
      value: route.params.locationId.toString()
    });
  }
  const getCriteriaFromFilterFields = (filterFields: FilterField[]) => {
    const initialCriteria: SearchCriteria = {
      filterFields: defaultFilterFields,
      pageSize: 10,
      pageNum: 0,
      sortField: 'location.name',
      direction: 'ASC'
    };
    let newFilterFields = [...initialCriteria.filterFields];
    filterFields.forEach((filterField) => {
      newFilterFields = newFilterFields.filter(
        (ff) => ff.field !== filterField.field
      );
    });
    return {
      ...initialCriteria,
      filterFields: [...newFilterFields, ...filterFields]
    };
  };
  const [criteria, setCriteria] = useState<SearchCriteria>(
    getCriteriaFromFilterFields([])
  );
  useEffect(() => {
    // Limpiar caché de búsqueda al entrar en la pantalla para asegurar un estado fresco.
    dispatch(assetActions.clearAssets());
  }, []);

  useEffect(() => {
    if (hasViewPermission(PermissionEntity.ASSETS) && view === 'list') {
      // Ordenación por defecto A-Z por nombre de ubicación para Activos en Mobile.
      // Impacto: Facilita al técnico ver los equipos agrupados por su sitio físico.
      dispatch(
        getAssets({
          ...criteria,
          pageSize: 10,
          pageNum: 0,
          sortField: 'location.name',
          direction: 'ASC'
        })
      );
    }
    // Se añade 'view' como dependencia para asegurar que la búsqueda se dispare al cambiar de jerarquía a lista.
  }, [criteria, view]);
  const [currentAssets, setCurrentAssets] = useState<AssetRow[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number | undefined>(
    route.params?.locationId
  );

  useEffect(() => {
    // Lógica de navegación contextual:
    // 1. Si entramos al nivel raíz (id=0), limpiamos la jerarquía para asegurar datos frescos.
    // 2. Si entramos a un nodo hijo, solo descargamos si no ha sido cargado ya.
    // 3. Pasamos locationId a la API para activar el filtrado por sitio en el servidor.
    const id = route.params?.id ?? 0;
    const locationId = route.params?.locationId;
    const hierarchy = route.params?.hierarchy ?? [];

    if (id === 0) {
      dispatch(assetActions.clearAssetsHierarchy());
    }

    setCurrentLocationId(locationId);

    if (id !== 0 && assetsHierarchy.some(asset => asset.hierarchy.includes(id) && asset.id !== id)) {
      return;
    }

    dispatch(getAssetChildren(id, hierarchy, locationId));
  }, [route.params?.id, route.params?.locationId]);

  useEffect(() => {
    if (route.params?.locationName) {
      navigation.setOptions({
        title: `${t('assets')} - ${route.params.locationName}`
      });
    }
  }, [route.params?.locationName, t]);

  const onRefresh = () => {
    setCriteria(getCriteriaFromFilterFields([]));
  };

  const onQueryChange = (query) => {
    setSearchQuery(query);
    if (query) {
      // Se añade 'location.name' a los campos de búsqueda en móvil para permitir encontrar activos por sitio.
      // Impacto: Consistencia con la versión web y mejor búsqueda contextual para el técnico de campo.
      // Se usa actualización funcional para evitar problemas de stale closure con el debounce.
      setCriteria((prevCriteria) =>
        getNewCriteriaOnSearch(query, prevCriteria, [
          'name',
          'model',
          'description',
          'additionalInfos',
          'location.name'
        ])
      );
      setView('list');
    } else {
      // Si la búsqueda se limpia, volvemos a la vista de jerarquía y limpiamos la caché.
      setView('hierarchy');
      setCriteria(getCriteriaFromFilterFields([]));
      dispatch(assetActions.clearAssets());
    }
  };
  useDebouncedEffect(
    () => {
      if (startedSearch) onQueryChange(searchQuery);
    },
    [searchQuery],
    1000
  );

  useEffect(() => {
    // Filtrado de visualización:
    // - En niveles inferiores (parentId presente), filtramos por el padre directo.
    // - En el nivel raíz (id=0), mostramos todos los activos con longitud de jerarquía 1.
    // El filtrado por ubicación se delega al servidor para mayor eficiencia.
    const parentId = route.params?.id;
    let result = [];

    if (parentId) {
      result = assetsHierarchy.filter(asset =>
        asset.hierarchy[asset.hierarchy.length - 2] === parentId && asset.id !== parentId
      );
    } else {
      /**
       * Para el nivel raíz, mostramos todos los activos que tienen nivel 1 en la jerarquía.
       * Si estamos filtrando por ubicación, la API ya devolvió solo los correspondientes.
       */
      result = assetsHierarchy.filter(asset => asset.hierarchy.length === 1);
    }
    /**
     * MEJORA DE ORGANIZACIÓN OPERATIVA:
     * Forzamos la ordenación A-Z por nombre de ubicación en el frontend.
     * Racional: Los técnicos necesitan ver los equipos agrupados por su sitio físico
     * para optimizar sus rutas de trabajo.
     * Impacto: Consistencia visual independientemente de cómo devuelva los datos la API.
     */
    const sortedResult = [...result].sort((a, b) => {
      const locationA = a.location?.name?.toLowerCase() || '';
      const locationB = b.location?.name?.toLowerCase() || '';
      if (locationA < locationB) return -1;
      if (locationA > locationB) return 1;

      /**
       * Criterio Secundario: Si están en la misma ubicación, ordenamos por nombre 
       * del activo para mantener un listado predecible.
       */
      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });
    setCurrentAssets(sortedResult);
  }, [assetsHierarchy, route.params?.id]);

  const handleViewChildren = (asset) => {
    navigation.push('Assets', {
      id: asset.id,
      hierarchy: asset.hierarchy,
      locationId: route.params?.locationId,
      locationName: route.params?.locationName
    });
  };

  return (
    <View
      style={{ ...styles.container, backgroundColor: theme.colors.background }}
    >
      <Searchbar
        placeholder={t('search')}
        onFocus={() => setStartedSearch(true)}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={{ backgroundColor: theme.colors.background }}
      />
      {view === 'list' ? (
        <ScrollView
          style={styles.scrollView}
          onScroll={({ nativeEvent }) => {
            if (isCloseToBottom(nativeEvent)) {
              if (!loadingGet && !lastPage)
                dispatch(getMoreAssets(criteria, currentPageNum + 1));
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
          scrollEventThrottle={400}
        >
          {!!assets.content.length ? (
            assets.content.map((asset) => (
              <AssetCard key={asset.id} asset={asset} navigation={navigation} />
            ))
          ) : loadingGet ? null : (
            <View
              style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 10
              }}
            >
              <Text variant={'titleLarge'}>
                {t('no_element_match_criteria')}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              colors={[theme.colors.primary]}
            />
          }
        >
          {loadingGet && !currentAssets.length ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text>{t('loading')}...</Text>
            </View>
          ) : !!currentAssets.length ? (
            currentAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                navigation={navigation}
                showChildrenButton={true}
                onViewChildren={() => handleViewChildren(asset)}
              />
            ))
          ) : !loadingGet && (
            <View
              style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 10
              }}
            >
              <Text variant={'titleLarge'}>
                {t('no_element_match_criteria')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  scrollView: {
    width: '100%',
    height: '100%',
    padding: 5
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  }
});
