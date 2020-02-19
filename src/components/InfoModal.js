import React from 'react';
import PropTypes from 'prop-types';
import { Text, Modal, IconButton, DefaultButton } from 'office-ui-fabric-react';

import './InfoModal.css';

const InfoModal = ({
  className = '',
  children,
  isOpen = false,
  onClose = () => {},
  title = '',
  closeText = 'Close',
  modalProps = {},
}) => (
  <Modal
    scrollableContentClassName="content-container"
    containerClassName={`info-modal ${className}`}
    isOpen={isOpen}
    onDismiss={onClose}
    isBlocking={false}
    {...modalProps}
  >
    <div className="header">
      <Text variant="large">{title}</Text>
      <IconButton
        className="cancel-icon"
        iconProps={{ iconName: 'Cancel' }}
        onClick={onClose}
      />
    </div>
    <div className="body">{children}</div>
    <div className="footer">
      <DefaultButton onClick={onClose}>{closeText}</DefaultButton>
    </div>
  </Modal>
);

InfoModal.propTypes = {
  /** Extra classes to apply to the modal content container. */
  className: PropTypes.string,
  /** Content of info modal. */
  children: PropTypes.node,
  /** Whether this info modal is currently open. */
  isOpen: PropTypes.bool,
  /** Handler function called when the modal should be closed. */
  onClose: PropTypes.func,
  /** The title of the info modal. */
  title: PropTypes.string,
  /** The text of the close button for the modal. */
  closeText: PropTypes.string,
  /** Extra props to apply to the Fabric modal. */
  modalProps: PropTypes.object,
};

export default InfoModal;
