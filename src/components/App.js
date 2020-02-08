import React from 'react';
import { Separator, Text, Stack } from 'office-ui-fabric-react';

import './App.css';

const App = () => {
  return (
    <Stack className="app">
      <Stack.Item>
        <Separator alignContent="start">
          <Text variant="xLarge">Slotty</Text>
        </Separator>
      </Stack.Item>

      <Stack.Item className="content-container">
        <Stack className="content" horizontal verticalAlign="center" horizontalAlign="space-evenly">
          <Stack.Item className="content-item">
            New Notification
          </Stack.Item>

          <Stack.Item className="content-item">
            <Separator vertical/>
          </Stack.Item>

          <Stack.Item className="content-item">
            Lookup Notification
          </Stack.Item>

          <Stack.Item className="content-item">
            <Separator vertical/>
          </Stack.Item>

          <Stack.Item className="content-item">
            Notification History
          </Stack.Item>
        </Stack>
      </Stack.Item>
    </Stack>
  );
};

export default App;
