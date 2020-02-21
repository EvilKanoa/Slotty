import React, { useState, useCallback, useMemo } from 'react';
import {
  Text,
  Separator,
  ComboBox,
  PrimaryButton,
  Stack,
  ProgressIndicator,
} from 'office-ui-fabric-react';
import { isEqual } from 'lodash';

import API from '../api';
import storage from '../storage';
import EditNotification from './EditNotification';
import LoadingModal from './LoadingModal';
import InfoModal from './InfoModal';
import Card from './Card';

const FindCard = () => {
  const [isSearchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState();
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState();
  const [notification, setNotification] = useState();
  const [remoteNotification, setRemoteNotification] = useState();
  const [search, setSearch] = useState('');

  const suggestedKeys = storage.get('suggested_keys', []);
  const keyOptions = useMemo(() => suggestedKeys.map(key => ({ key, text: key })), [
    suggestedKeys,
  ]);

  const isDirty = useMemo(
    () =>
      notification && remoteNotification && !isEqual(notification, remoteNotification),
    [notification, remoteNotification]
  );

  const onSearch = useCallback(
    async key => {
      if (!key || !key.length || isSearchLoading) {
        return;
      }

      setSearchLoading(true);
      try {
        const data = await API.getNotification(key);

        if (!data) {
          throw new Error('Notification not found!');
        } else if (data.accessKey !== key) {
          throw new Error('Failed to find a notification with the correct access key!');
        }

        if (!suggestedKeys.includes(key)) {
          storage.set('suggested_keys', [...suggestedKeys, key]);
        }

        const notification = {
          ...data,
          contact: data.contact && data.contact.slice(2),
        };

        setNotification(notification);
        setRemoteNotification(notification);
        setSearchError(undefined);
      } catch (err) {
        setNotification(undefined);
        setRemoteNotification(undefined);
        setSearchError(err);
      } finally {
        setSearchLoading(false);
      }
    },
    [setNotification, suggestedKeys, isSearchLoading]
  );
  const onSave = useCallback(
    async value => {
      if (value !== notification || !isDirty || isSaving) {
        return;
      }

      // create the update package by only including the relevant fields
      const updates = [...Object.keys(notification), ...Object.keys(remoteNotification)]
        .filter(key => notification[key] !== remoteNotification[key])
        .reduce((obj, key) => {
          obj[key] = notification[key] ?? null;
          return obj;
        }, {});
      if (updates.contact) {
        updates.contact = `+1${updates.contact}`;
      }

      setSaving(true);
      try {
        const data = await API.updateNotification(remoteNotification.accessKey, updates);

        if (!data) {
          throw new Error('New notification details not found!');
        }

        const notification = {
          ...data,
          contact: data.contact && data.contact.slice(2),
        };

        setNotification(notification);
        setRemoteNotification(notification);
        setSaveError(undefined);
      } catch (err) {
        setSaveError(err);
      } finally {
        setSaving(false);
      }
    },
    [
      notification,
      isDirty,
      isSaving,
      remoteNotification,
      setNotification,
      setRemoteNotification,
      setSaveError,
      setSaving,
    ]
  );
  const onPendingValueChange = useCallback((_opt, _idx, val) => setSearch(val || ''), [
    setSearch,
  ]);
  const onComboBoxChange = useCallback(
    (_e, opt, _idx, val) => onSearch(opt ? opt.key : val),
    [onSearch]
  );
  const onSearchClick = useCallback(() => onSearch(search), [onSearch, search]);
  const onReset = useCallback(() => {
    setSearch('');
    setNotification(undefined);
    setRemoteNotification(undefined);
    setSearchError(undefined);
  }, [setSearch, setNotification, setSearchError]);
  const onRevert = useCallback(() => {
    setNotification(remoteNotification);
  }, [remoteNotification, setNotification]);
  const onClearSaveError = useCallback(() => {
    setSaveError(undefined);
  }, [setSaveError]);

  return (
    <Card header="Look up an existing notification">
      <Text>
        Slotty will need the access key of the notification you're interested in looking
        up. This will have been given to you when you created the notification as well as
        included in all messages that Slotty sends you.
      </Text>
      <br />
      <Text>
        If you've already looked up a notification on this device previously, it will
        remain in the list so you can get back to it faster. Just click on the arrow on
        the right or start typing! Otherwise, just type in the access key of the
        notification you're interested in and hit enter!
      </Text>

      <Separator />

      <Stack horizontal verticalAlign="end" wrap={false} tokens={{ childrenGap: 12 }}>
        <Stack.Item grow>
          <ComboBox
            label="Select or enter the access key for your notification:"
            placeholder="Enter access key or select existing access key..."
            onChange={onComboBoxChange}
            onPendingValueChanged={onPendingValueChange}
            selectedKey={notification && notification.accessKey}
            options={keyOptions}
            allowFreeform
            autoComplete="on"
            disabled={isSearchLoading}
            buttonIconProps={{ iconName: 'FullHistory' }}
          />
        </Stack.Item>
        <Stack.Item>
          <PrimaryButton onClick={onSearchClick} disabled={isSearchLoading}>
            Search
          </PrimaryButton>
        </Stack.Item>
      </Stack>
      <ProgressIndicator percentComplete={isSearchLoading ? undefined : 1} />

      <Separator />

      <EditNotification
        value={notification || {}}
        disabled={isSearchLoading || !!searchError || !notification}
        onChange={setNotification}
        onReset={onRevert}
        onSave={onSave}
        canSave={isDirty}
      />

      <InfoModal
        isOpen={!isSearchLoading && !!searchError}
        title="Error encountered"
        onClose={onReset}
      >
        {searchError && searchError.toString()}
      </InfoModal>

      <InfoModal
        isOpen={!isSaving && !!saveError}
        title="Failed to save notification"
        onClose={onClearSaveError}
      >
        {saveError && saveError.toString()}
      </InfoModal>

      <LoadingModal isOpen={isSaving} message="Updating your notification..." />
    </Card>
  );
};

export default FindCard;
