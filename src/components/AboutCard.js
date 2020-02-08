import React, { useRef, useCallback } from 'react';
import { Text, Separator, Link } from 'office-ui-fabric-react';

import Card from './Card';

const AboutCard = () => {
  const cardRef = useRef(null);
  const closeSection = useCallback(() => cardRef.current && cardRef.current.close(), [
    cardRef,
  ]);

  return (
    <Card header="About Slotty" ref={cardRef}>
      <Text>
        Slotty is a small service designed to solve a simple problem. That problem is, as
        a university or college student, trying to register for a highly sought after
        course or section. You know what I'm talking about, when you really want to get
        into that perfect section, awesome course, or even that one you have to take, but
        every time you try to register, there's no open slots! No longer shall we students
        have to deal with checking if a course is open constantly! Say no to the stress of
        waiting to get into a required course! Say no to constantly being worried you may
        not even be able to take it! Instead, come say yes to Slotty and relax during
        course registration!
      </Text>

      <Separator />

      <Text variant="large">How does Slotty work?</Text>
      <br />
      <Text>
        It's really quite simple, as a student:
        <ol>
          <li>
            Create a new notification for a course and, optionally, a section that you
            need to register for but may fill up quickly.
          </li>
          <li>
            Wait for an available slot. Slotty is now checking with the school directly
            (using their registration services) to see if the course has had any slots
            open up. This check happens quick often (think seconds) ensuring that Slotty
            always knows the moment a slot is available.
          </li>
          <li>
            The moment a free slot appears for any course(s) or section(s) with
            notifications created, Slotty immediately sends you a text message letting you
            know about the newly available slots.
          </li>
          <li>
            It is now your job to register for the course quickly. Slotty has given you an
            edge since you know the moment a slot is available, now it's your turn to be
            fast and get registered!
          </li>
        </ol>
        Once you've successfully registered for a course, or something terrible happens
        and you can't register, you should come back to Slotty to delete the notification.
        This helps Slotty stay fast for everyone and will prevent you from getting
        pointless text messages.
      </Text>
      <br />
      <Text>
        Thanks to another open source project,{' '}
        <Link href="https://github.com/EvilKanoa/webadvisor-api" target="_blank">
          webadvisor-api
        </Link>
        , Slotty is able to request course data (including available slots) using a school
        agnostic method. This means that Slotty is able to support every school that
        webadvisor-api supports.
      </Text>

      <Separator />

      <Text variant="large">Should I use this?</Text>
      <br />
      <Text>
        If you meet the following requirements, you should consider using Slotty:
        <ul>
          <li>You are a university or college student with an upcoming study term.</li>
          <li>
            You have a mobile phone or some other device with a number to receive SMS
            messages through.
          </li>
          <li>
            You are worried about not getting a slot in a course you need or want to take.
          </li>
          <li>
            You are worried about not getting a slot in the section or meeting you want.
          </li>
          <li>
            You attend a school that is supported by Slotty (see school dropdown when
            creating a notification).
          </li>
        </ul>
      </Text>

      <Separator />

      <Text variant="large">Who made this?</Text>
      <br />
      <Text>
        This is a small project that is currently made entirely by me,{' '}
        <Link href="https://kanoa.tech" target="_blank">
          Kanoa Haley
        </Link>
        . I am a computer science student at the{' '}
        <Link href="https://www.uoguelph.ca/" target="_blank">
          University of Guelph
        </Link>{' '}
        and have dealt with stressful course registrations for years. This was initially
        just made for my own use, but I realized that a large number of other students
        could also benefit. This project is open sourced under the GPLv3 license and the
        source is available{' '}
        <Link href="https://github.com/EvilKanoa/Slotty" target="_blank">
          here
        </Link>{' '}
        in addition to the API documentation which is available{' '}
        <Link href="/api/docs" target="_blank">
          here
        </Link>
        . If you're interested in seeing other projects of mine, you can take a look at
        the rest of my{' '}
        <Link href="https://github.com/EvilKanoa" target="_blank">
          Github
        </Link>
        . Additionally, if you are not a student but an employer who has stumbled upon
        this, feel free to take a look at my{' '}
        <Link href="https://www.linkedin.com/in/kanoahaley/" target="_blank">
          LinkedIn
        </Link>{' '}
        as well.
      </Text>

      <Separator />

      <Text variant="large">How do I hide all this?</Text>
      <br />
      <Text>
        If you've already read everything here, or simply do not want to read it, you can
        hide this "About Slotty" section just by clicking on the title at the top of the
        section (or by <Link onClick={closeSection}>clicking here</Link>). This will work
        for all sections on this site, just click the title or anywhere on the title bar
        at the top and you can collapse and expand any section at will.
      </Text>
    </Card>
  );
};

export default AboutCard;
