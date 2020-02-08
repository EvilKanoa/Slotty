import React from 'react';
import { Separator, Text, Stack } from 'office-ui-fabric-react';

import AboutCard from './AboutCard';
import AddCard from './AddCard';
import FindCard from './FindCard';

import './App.css';

const App = () => {
  return (
    <Stack className="app" tokens={{ childrenGap: 16 }}>
      <Stack.Item>
        <Separator alignContent="center">
          <Text variant="xLarge">Slotty: Get Registered!</Text>
        </Separator>
      </Stack.Item>

      <Stack.Item>
        <Separator alignContent="center">
          <AboutCard />
        </Separator>
      </Stack.Item>

      <Stack.Item>
        <Separator alignContent="center">
          <AddCard />
        </Separator>
      </Stack.Item>

      <Stack.Item>
        <Separator alignContent="center">
          <FindCard />
        </Separator>
      </Stack.Item>
    </Stack>
  );
};

export default App;
