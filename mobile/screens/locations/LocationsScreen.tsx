import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import {
  locationActions,
  getLocationChildren,
  getLocations,
  getMoreLocations
} from '../../slices/location';
import { FilterField, SearchCriteria } from '../../models/page';
import {
  Button,
  Card,
  IconButton,
  List,
  Searchbar,
  Text,
  useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Location from '../../models/location';
import { IconSource } from 'react-native-paper/lib/typescript/components/Icon';
import {
  getNewCriteriaOnSearch,
  isCloseToBottom
} from '../../utils/overall';
import { RootStackScreenProps } from '../../types';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import Tag from '../../components/Tag';

export default function LocationsScreen({
  navigation,
  route
}: RootStackScreenProps<'Locations'>) {
  const { t } = useTranslation();
  const [startedSearch, setStartedSearch] = useState<boolean>(false);
  const {
    locations,
    locationsHierarchy,
    loadingGet,
    currentPageNum,
    lastPage
  } = useSelector((state) => state.locations);
  const theme = useTheme();
  const [view, setView] = useState<'hierarchy' | 'list'>('hierarchy');
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const { hasViewPermission } = useAuth();
  const defaultFilterFields: FilterField[] = [];
  const getCriteriaFromFilterFields = (filterFields: FilterField[]) => {
    const initialCriteria: SearchCriteria = {
      filterFields: defaultFilterFields,
      pageSize: 10,
      pageNum: 0,
      sortField: 'name',
      direction: 'ASC'
    };
    let newFilterFields = [...initialCriteria.filterFields];
    filterFields.forEach(
      (filterField) =>
      (newFilterFields = newFilterFields.filter(
        (ff) => ff.field != filterField.field
      ))
    );
    return {
      ...initialCriteria,
      filterFields: [...newFilterFields, ...filterFields]
    };
  };
  const [criteria, setCriteria] = useState<SearchCriteria>(
    getCriteriaFromFilterFields([])
  );
  useEffect(() => {
    if (hasViewPermission(PermissionEntity.LOCATIONS) && view === 'list') {
      // Ordenación por defecto A-Z por nombre para Localizaciones en Mobile.
      // Impacto: Organización clara de los sitios en la aplicación móvil.
      dispatch(
        getLocations({
          ...criteria,
          pageSize: 10,
          pageNum: 0,
          sortField: 'name',
          direction: 'ASC'
        })
      );
    }
    // Se añade 'view' como dependencia para asegurar que la búsqueda se dispare al cambiar de jerarquía a lista.
  }, [criteria, view]);
  const [currentLocations, setCurrentLocations] = useState([]);
  useEffect(() => {
    // Limpiar caché de búsqueda al entrar en la pantalla para asegurar un estado fresco.
    dispatch(locationActions.clearLocations());
  }, []);
  useEffect(() => {
    if (
      route.params?.id &&
      locationsHierarchy.some(
        (location) =>
          location.hierarchy.includes(route.params.id) &&
          location.id !== route.params.id
      )
    ) {
      return;
    }
    dispatch(
      getLocationChildren(route.params?.id ?? 0, route.params?.hierarchy ?? [])
    );
  }, [route]);

  const onRefresh = () => {
    setCriteria(getCriteriaFromFilterFields([]));
  };

  const onQueryChange = (query) => {
    setSearchQuery(query);
    if (query) {
      // Se utiliza actualización funcional de estado (prevCriteria) para evitar cierres obsoletos (stale closures)
      // durante el debounce, asegurando que la búsqueda siempre use los últimos filtros.
      setCriteria((prevCriteria) =>
        getNewCriteriaOnSearch(query, prevCriteria, ['name', 'address'])
      );
      setView('list');
    } else {
      // Si la búsqueda se limpia, volvemos a la vista de jerarquía y limpiamos la caché.
      setView('hierarchy');
      setCriteria(getCriteriaFromFilterFields([]));
      dispatch(locationActions.clearLocations());
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
    let result = [];
    if (route.params?.id) {
      result = locationsHierarchy.filter((location, index) => {
        return (
          location.hierarchy[location.hierarchy.length - 2] ===
          route.params.id && location.id !== route.params.id
        );
      });
    } else
      result = locationsHierarchy.filter(
        (location) => location.hierarchy.length === 1
      );
    setCurrentLocations(result.sort((a, b) => a.name.localeCompare(b.name)));
  }, [locationsHierarchy]);

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
                dispatch(getMoreLocations(criteria, currentPageNum + 1));
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
          {!!locations.content.length ? (
            locations.content.map((location) => (
              <Card
                style={{
                  marginVertical: 5,
                  backgroundColor: 'white'
                }}
                key={location.id}
                onPress={() =>
                  navigation.push('LocationDetails', {
                    id: location.id,
                    locationProp: location
                  })
                }
              >
                <Card.Content>
                  <List.Item
                    titleStyle={{ fontWeight: 'bold' }}
                    title={location.name}
                    description={location.address}
                    titleNumberOfLines={0}
                    descriptionNumberOfLines={0}
                  />
                </Card.Content>
              </Card>
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
          {!!currentLocations.length &&
            currentLocations.map((location) => (
              <Card
                style={{
                  marginVertical: 5,
                  backgroundColor: 'white'
                }}
                key={location.id}
                onPress={() =>
                  navigation.push('LocationDetails', {
                    id: location.id,
                    locationProp: location
                  })
                }
              >
                <Card.Content>
                  <List.Item
                    titleStyle={{ fontWeight: 'bold' }}
                    title={location.name}
                    description={location.address}
                    titleNumberOfLines={0}
                    descriptionNumberOfLines={0}
                  />
                </Card.Content>
                <Card.Actions>
                  {location.hasChildren && (
                    <Button
                      onPress={() => {
                        navigation.push('Locations', {
                          id: location.id,
                          hierarchy: location.hierarchy
                        });
                      }}
                    >
                      {t('view_children')}
                    </Button>
                  )}
                </Card.Actions>
              </Card>
            ))}
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
