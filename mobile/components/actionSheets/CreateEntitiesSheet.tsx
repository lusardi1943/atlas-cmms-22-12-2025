import ActionSheet, {
  ActionSheetRef,
  SheetProps
} from 'react-native-actions-sheet';
import { View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';
import * as React from 'react';
import { useContext, useRef } from 'react';
import { RootStackParamList } from '../../types';
import { useTranslation } from 'react-i18next';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import { useNetInfo } from '@react-native-community/netinfo';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { IconSource } from 'react-native-paper/lib/typescript/components/Icon';
import { navigationRef } from '../../navigation/RootNavigation';

export default function CreateEntitiesSheet(
  props: SheetProps<{ navigation: any }>
) {
  const { t } = useTranslation();
  const { hasCreatePermission } = useAuth();
  const netInfo = useNetInfo();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const entities: {
    title: string;
    icon: IconSource;
    goTo: keyof RootStackParamList;
    entity: PermissionEntity;
  }[] = [
      {
        title: t('work_order'),
        icon: 'clipboard-text-outline',
        goTo: 'AddWorkOrder',
        entity: PermissionEntity.WORK_ORDERS
      },
      {
        title: t('request'),
        icon: 'inbox-arrow-down-outline',
        goTo: 'AddRequest',
        entity: PermissionEntity.REQUESTS
      },
      {
        title: t('asset'),
        icon: 'package-variant-closed',
        goTo: 'AddAsset',
        entity: PermissionEntity.ASSETS
      },
      {
        title: t('location'),
        icon: 'map-marker-outline',
        goTo: 'AddLocation',
        entity: PermissionEntity.LOCATIONS
      },
      {
        title: t('part'),
        icon: 'archive-outline',
        goTo: 'AddPart',
        entity: PermissionEntity.PARTS_AND_MULTIPARTS
      },
      {
        title: t('meter'),
        icon: 'gauge',
        goTo: 'AddMeter',
        entity: PermissionEntity.METERS
      },
      {
        title: t('user'),
        icon: 'account-outline',
        goTo: 'AddUser',
        entity: PermissionEntity.PEOPLE_AND_TEAMS
      }
    ];
  return (
    <ActionSheet ref={actionSheetRef}>
      <View style={{ paddingHorizontal: 5, paddingVertical: 15 }}>
        <Text style={{ paddingHorizontal: 15 }} variant="headlineSmall">
          {t('create')}
        </Text>
        <Divider />
        {netInfo.isInternetReachable ? (
          <List.Section>
            {entities
              .filter((entity) => hasCreatePermission(entity.entity))
              .map((entity, index) => (
                <List.Item
                  key={index}
                  style={{ paddingHorizontal: 15 }}
                  title={entity.title}
                  left={() => <List.Icon icon={entity.icon} />}
                  onPress={() => {
                    const currentRoute = navigationRef.getCurrentRoute();
                    const routeParams = currentRoute?.params as any;
                    let params: any = {};
                    /**
                     * Detección de contexto global:
                     * Si el usuario está creando una OT desde el botón (+), intentamos capturar
                     * si está viendo detalles de un activo o ubicación para pre-poblar el formulario.
                     */
                    if (entity.goTo === 'AddWorkOrder') {
                      if (currentRoute?.name === 'AssetDetails') {
                        params.asset =
                          routeParams?.assetProp || routeParams?.asset;
                      } else if (currentRoute?.name === 'LocationDetails') {
                        params.location =
                          routeParams?.locationProp || routeParams?.location;
                      } else if (
                        currentRoute?.name === 'Assets' &&
                        routeParams?.locationId
                      ) {
                        params.location = {
                          id: routeParams.locationId,
                          name: routeParams.locationName
                        };
                      }
                    }
                    props.payload.navigation.navigate(entity.goTo, params);
                    actionSheetRef.current.hide();
                  }}
                />
              ))}
          </List.Section>
        ) : (
          <Text style={{ padding: 20 }} variant={'bodyLarge'}>
            {t('no_internet_connection')}
          </Text>
        )}
      </View>
    </ActionSheet>
  );
}
