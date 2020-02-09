import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Text,
  Dropdown,
  Separator,
  TextField,
  MaskedTextField,
  CompoundButton,
  Stack,
  TooltipHost,
  TooltipDelay,
} from 'office-ui-fabric-react';

import ConfirmDialog from './ConfirmDialog';
import Card from './Card';

import './AddCard.css';

const schools = {
  UOG: 'University of Guelph',
  WLU: 'Wilfrid Laurier University',
};
const terms = {
  W20: 'Winter 2020',
  S20: 'Summer 2020',
  F20: 'Fall 2020',
  W21: 'Winter 2021',
  S21: 'Summer 2021',
  F21: 'Fall 2021',
  W22: 'Winter 2022',
  S22: 'Summer 2022',
  F22: 'Fall 2022',
  W23: 'Winter 2023',
  S23: 'Summer 2023',
  F23: 'Fall 2023',
};

const objToOptions = obj => Object.keys(obj).map(key => ({ key, text: obj[key] }));
const schoolOptions = objToOptions(schools);
const termOptions = objToOptions(terms);

const defaultNotification = {
  institutionKey: '',
  termKey: '',
  contact: '',
  courseKey: '',
  sectionKey: '',
};

const AddCard = () => {
  const confirmRef = useRef(null);

  const [notification, setNotification] = useState(defaultNotification);

  const canSave = useMemo(() => {
    const { institutionKey, termKey, contact, courseKey } = notification;
    return (
      schools[institutionKey] && terms[termKey] && contact.length && courseKey.length
    );
  }, [notification]);

  const makeTextOnChange = useCallback(
    key => (_event, value) => setNotification({ ...notification, [key]: value }),
    [notification, setNotification]
  );
  const makeDropdownOnChange = useCallback(
    key => (_event, value) => setNotification({ ...notification, [key]: value.key }),
    [notification, setNotification]
  );
  const onContactChange = useCallback(
    (_event, value) =>
      setNotification({ ...notification, contact: value.replace(/\(|\)|\s|-|_/g, '') }),
    [notification, setNotification]
  );

  const onReset = useCallback(() => setNotification(defaultNotification), [
    setNotification,
  ]);
  const onSave = useCallback(async () => {
    if (await confirmRef.current.confirm()) {
      console.log('saving!');
    } else {
      console.log('not saving!');
    }
  }, [confirmRef]);

  return (
    <Card className="add-notification-card" header="Create a new notification">
      <Text>
        Create a new notification for a whole course or a specific section. Please be
        aware that each notification you create will lead to text messages being sent.
      </Text>

      <Separator />

      <Text>First, Slotty needs to know a little about you.</Text>
      <Dropdown
        label="Select your school:"
        placeholder="Select a school..."
        options={schoolOptions}
        selectedKey={notification.institutionKey}
        onChange={makeDropdownOnChange('institutionKey')}
        required
      />
      <Dropdown
        label="Select the term you're registering in:"
        placeholder="Select a term..."
        options={termOptions}
        selectedKey={notification.termKey}
        onChange={makeDropdownOnChange('termKey')}
        required
      />
      <MaskedTextField
        label="Enter your phone number to receive notifications at:"
        description="Note: Slotty currently only supports Canadian phone numbers."
        mask="(999) 999 - 9999"
        value={notification.contact}
        onChange={onContactChange}
        required
      />

      <Separator />

      <Text>
        Now, tell Slotty what course you're interested in. If you do not specify a
        section, Slotty will send you a message whenever any section for that course
        opens.
      </Text>
      <TextField
        label="Enter the course code for the course you're interested in:"
        description="e.g. CIS*1500, MA100, MATH*1200, PS101."
        value={notification.courseKey}
        onChange={makeTextOnChange('courseKey')}
        required
      />
      <TextField
        label="(Optional) Enter the section or meeting code that you're interested in:"
        description="e.g. for CIS*1500*0101 enter 0101, for WLU enter the CRN."
        value={notification.sectionKey}
        onChange={makeTextOnChange('sectionKey')}
      />

      <Separator />
      <Stack horizontal wrap horizontalAlign="space-around" tokens={{ childrenGap: 16 }}>
        <Stack.Item>
          <CompoundButton
            secondaryText="Clears this form resetting all input fields to empty values."
            onClick={onReset}
          >
            Reset
          </CompoundButton>
        </Stack.Item>
        <Stack.Item className="add-notification-create-button">
          <TooltipHost
            content={
              !canSave && (
                <Text>
                  Please provide information for all required fields before creating a new
                  notification.
                </Text>
              )
            }
            delay={TooltipDelay.zero}
          >
            <CompoundButton
              secondaryText="Creates a new notification for the specified course with your details."
              onClick={onSave}
              disabled={!canSave}
              primary
            >
              Create
            </CompoundButton>
          </TooltipHost>
        </Stack.Item>
      </Stack>

      <ConfirmDialog
        title="Create Notification"
        message="Are you sure you want to create a new notification and receive updates for available slots at the phone number listed?"
        confirmText="Create"
        ref={confirmRef}
      />
    </Card>
  );
};

export default AddCard;
