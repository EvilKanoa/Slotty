import React, {
  useState,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import PropTypes from 'prop-types';
import {
  Separator,
  Text,
  FontIcon,
  TooltipHost,
  TooltipDelay,
  DirectionalHint,
} from 'office-ui-fabric-react';
import Expand from 'react-expand-animated';

import './Card.css';

/**
 * Container component that includes a collapsable content area and a header.
 */
const Card = forwardRef(({ header, defaultOpen = true, children }, ref) => {
  const [isOpen, setOpen] = useState(defaultOpen);
  const onHeaderClick = useCallback(() => setOpen(isOpen => !isOpen), [setOpen]);
  const tooltipText = useMemo(
    () => `Click to ${isOpen ? 'collapse' : 'expand'} this section.`,
    [isOpen]
  );
  const headerIconName = useMemo(() => (isOpen ? 'ChevronDown' : 'ChevronRight'), [
    isOpen,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      toggle: onHeaderClick,
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [onHeaderClick, setOpen]
  );

  return (
    <div className="card-container">
      <TooltipHost
        content={tooltipText}
        delay={TooltipDelay.long}
        directionalHint={DirectionalHint.topCenter}
        className="card-header-tooltip"
      >
        <div className="card-header" onClick={onHeaderClick}>
          <Separator alignContent="start" className="card-header-bar">
            <FontIcon className="card-header-icon" iconName={headerIconName} />
            {header && <Text variant="large">{header}</Text>}
          </Separator>
        </div>
      </TooltipHost>

      <Expand open={isOpen}>
        <div className="card-content">{children}</div>
      </Expand>
    </div>
  );
});

Card.propTypes = {
  /** Header title for the card. Will always be visible. */
  header: PropTypes.string,
  /** Whether the card should initially be opened or collapsed. */
  defaultOpen: PropTypes.bool,
  /** Content to display within the card. */
  children: PropTypes.node,
  /** Allows you top manually control the open or close state of this card programmatically. This function will passed the `setOpen` function which allows you to set the open state of the card. */
  setOpenRef: PropTypes.func,
};

export default Card;
