import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  TextField,
  MaskedTextField,
  Dropdown,
  Checkbox,
  Stack,
  DefaultButton,
  PrimaryButton,
} from 'office-ui-fabric-react';

import { schools, terms, defaultNotification } from '../constants';

const objToOptions = obj => Object.keys(obj).map(key => ({ key, text: obj[key] }));
const schoolOptions = objToOptions(schools);
const termOptions = objToOptions(terms);

const EditNotification = ({
  initialValue = defaultNotification,
  value,
  disabled = false,
  showFooter = true,
  canSave = true,
  onChange = () => {},
  onSave = () => {},
  onReset = () => {},
}) => {
  const [notification, setNotification] = useState(initialValue);
  useEffect(() => {
    if (value) {
      setNotification(value);
    }
  }, [value, setNotification]);

  const onSetNotification = useCallback(
    newValues => {
      const newNotification = { ...notification, ...newValues };
      Object.keys(newNotification).forEach(key => {
        if (newNotification[key] === undefined) {
          delete newNotification[key];
        }
      });
      setNotification(newNotification);
      onChange(newNotification);
    },
    [notification, setNotification, onChange]
  );
  const onSaveHandler = useCallback(() => onSave(notification), [notification, onSave]);
  const onResetHandler = useCallback(() => onReset(), [onReset]);

  const isValidInput = useMemo(() => {
    const { institutionKey, termKey, contact, courseKey } = notification;
    return (
      schools[institutionKey] &&
      terms[termKey] &&
      contact &&
      contact.length > 0 &&
      courseKey &&
      courseKey.length > 0
    );
  }, [notification]);

  return (
    <>
      <Stack tokens={{ childrenGap: 10 }}>
        <Stack.Item>
          <TextField
            label="Access key:"
            value={notification.accessKey || ''}
            onChange={useCallback(() => {}, [])}
            disabled
            required
          />
        </Stack.Item>
        <Stack.Item>
          <Checkbox
            label="Enabled:"
            disabled={disabled}
            checked={!!notification.enabled}
            onChange={useCallback((_e, enabled) => onSetNotification({ enabled }), [
              onSetNotification,
            ])}
            boxSide="end"
            required
          />
        </Stack.Item>
        <Stack.Item>
          <Checkbox
            label="Verified number:"
            checked={!!notification.verified}
            onChange={useCallback(() => {}, [])}
            boxSide="end"
            required
            disabled
          />
        </Stack.Item>
      </Stack>
      <Dropdown
        label="School:"
        disabled={disabled}
        options={schoolOptions}
        selectedKey={notification.institutionKey}
        onChange={useCallback(
          (_e, { key: institutionKey }) => onSetNotification({ institutionKey }),
          [onSetNotification]
        )}
        required
      />
      <Dropdown
        label="Term:"
        disabled={disabled}
        options={termOptions}
        selectedKey={notification.termKey}
        onChange={useCallback((_e, { key: termKey }) => onSetNotification({ termKey }), [
          onSetNotification,
        ])}
        required
      />
      <MaskedTextField
        label="Phone number:"
        disabled={disabled}
        mask="(999) 999 - 9999"
        value={notification.contact || ''}
        onChange={useCallback(
          (_e, value) =>
            onSetNotification({
              contact: value.replace(/\(|\)|\s|-|_/g, ''),
            }),
          [onSetNotification]
        )}
        onGetErrorMessage={useCallback(
          value =>
            value && value.replace(/\(|\)|\s|-|_/g, '').length > 0
              ? ''
              : 'Please enter a valid 10 digit phone number.',
          []
        )}
        validateOnLoad={false}
        validateOnFocusOut={true}
        required
      />
      <TextField
        label="Course:"
        disabled={disabled}
        value={notification.courseKey || ''}
        onChange={useCallback((_e, courseKey) => onSetNotification({ courseKey }), [
          onSetNotification,
        ])}
        onGetErrorMessage={useCallback(
          value =>
            value && value.length > 0
              ? ''
              : 'Please enter a course code for the course you wish to receive notifications about.',
          []
        )}
        validateOnLoad={false}
        validateOnFocusOut={true}
        required
      />
      <TextField
        label="Section:"
        disabled={disabled}
        value={notification.sectionKey || ''}
        onChange={useCallback(
          (_e, sectionKey) =>
            onSetNotification({
              sectionKey: sectionKey && sectionKey.length > 0 ? sectionKey : undefined,
            }),
          [onSetNotification]
        )}
        required
      />

      {showFooter && (
        <>
          <br />
          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end">
            <Stack.Item>
              <DefaultButton onClick={onResetHandler} disabled={disabled || !canSave}>
                Reset
              </DefaultButton>
            </Stack.Item>
            <Stack.Item>
              <PrimaryButton
                onClick={onSaveHandler}
                disabled={disabled || !canSave || !isValidInput}
              >
                Save
              </PrimaryButton>
            </Stack.Item>
          </Stack>
        </>
      )}
    </>
  );
};

EditNotification.propTypes = {
  /** Initial notification value to be used when first mounting. */
  initialValue: PropTypes.object,
  /** Optional prop to control the value of this component if needed. */
  value: PropTypes.object,
  /** Flag to indicate to this group of inputs should be currently disabled. */
  disabled: PropTypes.bool,
  /** Flag to indicate whether a footer containing a reset and save button should be rendered. */
  showFooter: PropTypes.bool,
  /** Flag to indicate whether the reset and save buttons should be disabled, ignore if showFooter = false. */
  canSave: PropTypes.bool,
  /** Handler that is called when any value is changed with the current form value. */
  onChange: PropTypes.func,
  /** Handler that is called when the save button is clicked with the current form value. */
  onSave: PropTypes.func,
  /** Handler that is called when the reset button is clicked. */
  onReset: PropTypes.func,
};

export default EditNotification;
