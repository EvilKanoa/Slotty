import React, { useCallback, useRef } from 'react';
import {
  Text,
  Dropdown,
  Separator,
  TextField,
  MaskedTextField,
  CompoundButton,
  Stack,
} from 'office-ui-fabric-react';

import ConfirmDialog from './ConfirmDialog';
import Card from './Card';

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

const AddCard = () => {
  const confirmRef = useRef(null);

  const onSave = useCallback(async () => {
    if (await confirmRef.current.confirm()) {
      console.log('saving!');
    } else {
      console.log('not saving!');
    }
  }, [confirmRef]);

  return (
    <Card header="Create a new notification">
      <Text>
        Create a new notification for a whole course or a specific section. Please be
        aware that each notification you create will lead to text messages being sent.
      </Text>

      <Separator />

      <Text>First, Slotty needs to know a little about you.</Text>
      <Dropdown label="Select your school:" options={schoolOptions} />
      <Dropdown label="Select the term you're registering in:" options={termOptions} />
      <MaskedTextField
        label="Enter your phone number to receive notifications at:"
        mask="(999) 999 - 9999"
      />
      <Text>Note: Slotty currently only supports Canadian phone numbers.</Text>

      <Separator />

      <Text>
        Now, tell Slotty what course you're interested in. If you do not specify a
        section, Slotty will send you a message whenever any section for that course
        opens.
      </Text>
      <TextField label="Enter the course code for the course you're interested in:" />
      <Text>e.g. CIS*1500, MA100, MATH*1200, PS110.</Text>
      <TextField label="(Optional) Enter the section or meeting code that you're interested in:" />
      <Text>e.g. for CIS*1500*0101 enter 0101, for WLU enter the CRN.</Text>

      <Separator />
      <Stack horizontal wrap horizontalAlign="space-around" tokens={{ childrenGap: 16 }}>
        <Stack.Item>
          <CompoundButton secondaryText="Clears this form resetting all input fields to empty values. ">
            Reset
          </CompoundButton>
        </Stack.Item>
        <Stack.Item>
          <CompoundButton
            onClick={onSave}
            secondaryText="Creates a new notification for the course specified with your details."
            primary
          >
            Create
          </CompoundButton>
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
