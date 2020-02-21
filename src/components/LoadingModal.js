import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Spinner, SpinnerSize } from 'office-ui-fabric-react';

import './LoadingModal.css';

const LoadingModal = ({
  isOpen = true,
  message = '',
  modalProps = {},
  spinnerProps = {},
}) => (
  <Modal
    isOpen={isOpen}
    isBlocking
    containerClassName="loading-modal-container"
    scrollableContentClassName="loading-modal-content"
    {...modalProps}
  >
    <Spinner label={message} size={SpinnerSize.large} {...spinnerProps} />
  </Modal>
);

LoadingModal.propTypes = {
  /** Whether this loading modal should be shown, defaults to true. */
  isOpen: PropTypes.bool,
  /** The message displayed in this loading modal, defaults to empty string. */
  message: PropTypes.string,
  /** Manual override of any props passed to the Fabric modal. */
  modalProps: PropTypes.object,
  /** Manual override of any props passed to the Fabric spinner. */
  spinnerProps: PropTypes.object,
};

export default LoadingModal;
