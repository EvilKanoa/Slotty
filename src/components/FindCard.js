import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Text, Separator, ComboBox } from 'office-ui-fabric-react';

import API from '../api';
import storage from '../storage';
import Card from './Card';

const FindCard = () => {
  const [notification, setNotification] = useState({});

  const suggestedKeys = storage.get('suggested_keys', []);
  const keyOptions = useMemo(() => suggestedKeys.map(key => ({ key, text: key })), [
    suggestedKeys,
  ]);

  const onSearch = useCallback(
    (_event, _option, _index, value) => {
      if (!value || value === notification.accessKey) {
        return;
      }

      API.getNotification(value)
        .then(data => {
          if (!data) {
            throw new Error('Notification not found!');
          } else if (data.accessKey !== value) {
            throw new Error('Failed to find a notification with the correct access key!');
          }

          if (!suggestedKeys.includes(value)) {
            storage.set('suggested_keys', [...suggestedKeys, value]);
          }

          setNotification(data);
        })
        .catch(err => {
          setNotification({});
          console.error('Error encountered :(', err);
        });
    },
    [notification, setNotification, suggestedKeys]
  );

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

      <ComboBox
        label="Select or enter the access key for your notification:"
        placeholder="Enter access key or select existing access key..."
        onChange={onSearch}
        selectedKey={notification.accessKey}
        options={keyOptions}
        allowFreeform
        autoComplete="on"
      />
    </Card>
  );
};

export default FindCard;
