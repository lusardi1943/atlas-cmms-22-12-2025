import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { View } from '../../components/Themed';
import { RootStackScreenProps } from '../../types';
import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from '../../store';
import { VendorMiniDTO } from '../../models/vendor';
import { getVendorsMini } from '../../slices/vendor';
import { Checkbox, Divider, Searchbar, Text, useTheme } from 'react-native-paper';
import { includesNormalized } from '../../utils/strings';

export default function SelectVendorsModal({
  navigation,
  route
}: RootStackScreenProps<'SelectVendors'>) {
  const { onChange, selected, multiple } = route.params;
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { vendorsMini, loadingGet } = useSelector((state) => state.vendors);
  const [selectedVendors, setSelectedVendors] = useState<VendorMiniDTO[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (vendorsMini.length) {
      const newSelectedVendors = selectedIds
        .map((id) => {
          return vendorsMini.find((vendor) => vendor.id == id);
        })
        .filter((vendor) => !!vendor);
      setSelectedVendors(newSelectedVendors);
    }
  }, [selectedIds, vendorsMini]);

  useEffect(() => {
    if (!selectedIds.length) setSelectedIds(selected);
  }, [selected]);

  useEffect(() => {
    if (multiple)
      navigation.setOptions({
        headerRight: () => (
          <Pressable
            disabled={!selectedVendors.length}
            onPress={() => {
              onChange(selectedVendors);
              navigation.goBack();
            }}
          >
            <Text variant='titleMedium'>{t('add')}</Text>
          </Pressable>
        )
      });
  }, [selectedVendors]);

  useEffect(() => {
    dispatch(getVendorsMini());
  }, []);

  const onSelect = (ids: number[]) => {
    setSelectedIds(Array.from(new Set([...selectedIds, ...ids])));
    if (!multiple) {
      onChange([vendorsMini.find((vendor) => vendor.id === ids[0])]);
      navigation.goBack();
    }
  };
  const onUnSelect = (ids: number[]) => {
    const newSelectedIds = selectedIds.filter((id) => !ids.includes(id));
    setSelectedIds(newSelectedIds);
  };
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onUnSelect([id]);
    } else {
      onSelect([id]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder={t('search')}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={{ backgroundColor: theme.colors.background }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={loadingGet}
            onRefresh={() => dispatch(getVendorsMini())}
          />
        }
        style={{
          flex: 1,
          backgroundColor: theme.colors.background
        }}
      >
        {vendorsMini
          .filter((vendor) => includesNormalized(vendor.companyName, searchQuery))
          .sort((a, b) => a.companyName.localeCompare(b.companyName))
          .map((vendor) => (
            <TouchableOpacity
              onPress={() => {
                toggle(vendor.id);
              }}
              key={vendor.id}
              style={{
                borderRadius: 5,
                padding: 15,
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'row',
                elevation: 2,
                alignItems: 'center'
              }}
            >
              {multiple && (
                <Checkbox
                  status={
                    selectedIds.includes(vendor.id) ? 'checked' : 'unchecked'
                  }
                  onPress={() => {
                    toggle(vendor.id);
                  }}
                />
              )}
              <Text style={{ flexShrink: 1 }} variant={'titleMedium'}>
                {vendor.companyName}
              </Text>
              <Divider />
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
