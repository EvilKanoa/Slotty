import React, {
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogType,
  DialogFooter,
  DefaultButton,
  PrimaryButton,
} from 'office-ui-fabric-react';

/**
 * Prebuilt confirmation dialog. Allows imperative, asynchronous confirmations through refs.
 * @example
 * const MyForm = () => {
 *   const confirmRef = useRef(null);
 *
 *   // you could use it in any handler
 *   const onSave = async () => {
 *     // check if the user confirms this action
 *     if (await confirmRef.current.confirm()) {
 *       // the user selected confirm
 *     } else {
 *       // the user selected cancel
 *     }
 *   };
 *
 *   return (
 *     <>
 *       ... form stuff here ...
 *
 *       <ConfirmDialog ref={confirmRef} />
 *     </>
 *   );
 * };
 */
const ConfirmDialog = forwardRef(
  (
    {
      title = 'Confirm',
      message = 'Please confirm.',
      cancelText = 'Cancel',
      confirmText = 'Confirm',
    },
    ref
  ) => {
    const promiseRef = useRef(null);
    const [isOpen, setOpen] = useState(false);

    const closeHandler = useCallback(() => {
      promiseRef.current = null;
      setOpen(false);
    }, [promiseRef, setOpen]);

    const onCancel = useCallback(() => {
      if (promiseRef.current) {
        promiseRef.current.resolve(false);
      }
      closeHandler();
    }, [promiseRef, closeHandler]);
    const onConfirm = useCallback(() => {
      if (promiseRef.current) {
        promiseRef.current.resolve(true);
      }
      closeHandler();
    }, [promiseRef, closeHandler]);

    useImperativeHandle(
      ref,
      () => ({
        confirm: () => {
          if (promiseRef.current) {
            return Promise.reject('Dialog already open');
          }

          return new Promise((resolve, reject) => {
            promiseRef.current = { resolve, reject };
            setOpen(true);
          });
        },
      }),
      []
    );

    return (
      <Dialog
        hidden={!isOpen}
        onDismiss={onCancel}
        dialogContentProps={{
          type: DialogType.normal,
          title,
          closeButtonAriaLabel: 'Close',
          subText: message,
        }}
        modalProps={{ isBlocking: false, dragOptions: undefined }}
      >
        <DialogFooter>
          <DefaultButton onClick={onCancel}>{cancelText}</DefaultButton>
          <PrimaryButton onClick={onConfirm}>{confirmText}</PrimaryButton>
        </DialogFooter>
      </Dialog>
    );
  }
);

ConfirmDialog.propTypes = {
  /** The title of the confirmation dialog. */
  title: PropTypes.string,
  /** The message displayed in the body of the confirmation dialog. */
  message: PropTypes.string,
  /** The text of the cancel button. */
  cancelText: PropTypes.string,
  /** The text of the confirm button. */
  confirmText: PropTypes.string,
};

export default ConfirmDialog;
