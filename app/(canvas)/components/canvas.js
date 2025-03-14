"use client";
/** @jsxImportSource @emotion/react */
import {
  Avatar,
  Box,
  css,
  Button,
  ButtonGroup,
  ClickAwayListener,
  Tooltip,
  Typography,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import {
  ArrowArcLeft,
  ArrowArcRight,
  ArrowsClockwise,
  BoundingBox,
  Cursor,
  Eraser,
  Lightbulb,
  PaintBucket,
  Pencil,
  TextAa,
} from "@phosphor-icons/react";
import { LineSegment } from "@phosphor-icons/react/dist/ssr";
import getStroke from "perfect-freehand";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import rough from "roughjs/bundled/rough.esm";
import { ColorPicker } from "primereact/colorpicker";
import { inspireMeGenerator } from "@/app/(standard)/(home)/create/utils/inspireMeGenerator";

//rough.js tool for generating shapes
const generator = rough.generator();

//function for creating squares or lines
const createElement = (id, x1, y1, x2, y2, type, color, fill = false) => {
  switch (type) {
    case "line":
    case "rectangle":
      const options = {
        // Passing in options for canvas mutability.
        stroke: `#${color}`,
        fill: fill ? `#${color}` : "transparent",
        fillStyle: "solid", // Fill shape with solid color selected
      };
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2, options)
          : generator.rectangle(x1, y1, x2 - x1, y2 - y1, options);
      return { id, x1, y1, x2, y2, type, roughElement, color, fill, options };
    case "pencil":
      return {
        id,
        type,
        points: [{ x: x1, y: y1 }],
        color,
        fill: fill || false,
      };
    case "text":
      return { id, type, x1, y1, x2, y2, text: "", color };

    default: // If type isn't a specified case => throw err
      throw new Error(`Invalid type: type not recognised: ${type}`);
  }
};

// Function to check if a point is near another point. We use it for resizing elements
//check the x/y position of the mouse and compares it to the x1 position of the element. Name is the part of the element - ie tr, br, bl, tl
//checks if the x and y positions are within 5 pixels and if they are it returns the name
const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

//Function to determine the position of the mouse in relation to an element
//first checks if the mouse is near any of the points of the rectangle and calls the nearpoint function
//it also check if the mouse is inside the element

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null; // To increase accuracy of selection on drawing points => increase offset value
};

//the else statement does the same but for a line - but checks if the mouse is at the start, end or anywhere along the line
const positionWithinElement = (x, y, element) => {
  const { type, x1, x2, y1, y2 } = element;

  switch (type) {
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || topRight || bottomLeft || bottomRight || inside;
    case "pencil":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) {
          return false;
        }
        return (
          onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null
        );
      });
      return betweenAnyPoint ? "inside" : null;
    case "text":
      return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    default:
      throw new Error(`Invalid type: type not recognised: ${type}`);
  }
};

// Function to calculate the distance between two points for calculating if the cursor is on the line or not. A line is made up
//of points a and b and a distance between them. If you introduce a third point and meaasure the distance between all three
//the measurement will stay the same if it is on the line, but increase if the mouse(point c) if off the line
const distance = (a, b) =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

//this is to determin what element is at a specific loction on the canvas
//it maps though each element and for each element it calls the positionWithinElement function to determin if the x, y coordinates of the mouse
//are in or near the element. It returns either inside, or tl, tr, br, bl for the corners - nor null if the mouse is not inside or near an element
//the find method then looks though the returned elemetns for the first one that is not null

const getElementAtPosition = (x, y, elements) => {
  return elements
    .map((element) => ({
      ...element,
      position: positionWithinElement(x, y, element),
    }))
    .find((element) => element.position !== null);
};

//this ensures the coordinates of the drawn elements are consistant regardless of what direction they were drawn in = for example if the user
//draws a square from top left to bottom right x1, y1 would be in the top left, and x2, y2 would be in the bottom right. If the user draws
//a square from the bottom up - for instance the bottom right, then this would be x1, y1. This needs to be normalised
//so our shape coordinate data is consistant.
const adjustElementCoordinates = (element) => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, x2, y1, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

//determins the style of curser that should be shown depending upon where on an object the user is pointing - ir blank canvas for drawing,
// middle of element for moving, or edge of element for resizing
const cursorForPosition = (position) => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
};

//calculates the new coordinates when an element is resized. The cases determin where o the object the curser is, and
//therefore whihc coordinate should be updated.
const resizedCoordinates = (x, y, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: x, y1: y, x2, y2 };
    case "tr":
      return { x1, y1: y, x2: x, y2 };
    case "bl":
      return { x1: x, y1, x2, y2: y };
    case "br":
    case "end":
      return { x1, y1, x2: x, y2: y };
    default:
      return null;
  }
};

//main component of the app.
//STATES
//elements - hold the currently drawn elements in an array of objects with the coordinates
//action - used to determin if the user is drawing, resizing or moving
//tool - stores whihc tool is currently selected - line, rectangle
//selectedElement - used to store the currently selected element for moving or resizing

const useHistory = (initialState, setRawDrawingData) => {
  const [index, setIndex] = useState(initialState.length);
  const [history, setHistory] = useState([initialState]);
  const setState = (action, overwrite = false) => {
    const newState =
      typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index + 1);
      setHistory([...updatedState, newState]);
      setIndex((prevState) => prevState + 1);
    }
  };

  const undo = () => {
    index > 0 && setIndex((prevState) => prevState - 1);
    index > 0 && setRawDrawingData(history[index - 1]);
  };
  const redo = () => {
    index < history.length - 1 && setIndex((prevState) => prevState + 1);
    index < history.length - 1 && setRawDrawingData(history[index + 1]);
  };

  return [history[index], setState, undo, redo]; //returns the current state and the set state function
};

const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

const drawElement = (roughCanvas, context, element) => {
  switch (element.type) {
    case "line":
    case "rectangle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      // Options params for the stroke (thickness etc.)
      context.strokeStyle = `#${element.color}`;
      context.fillStyle = `#${element.color}`;

      const stroke = getSvgPathFromStroke(
        getStroke(element.points, { size: 4 })
      );

      const path = new Path2D(stroke);
      // Checks if the element is filled or not
      if (element.fill) {
        context.fill(path);
      } else {
        context.stroke(path); // Not filled => stroke
      }
      break;
    case "text":
      context.textBaseline = "middle";
      context.font = "24px sans-serif";
      context.fillStyle = `#${element.color}`;
      context.fillText(element.text, element.x1, element.y1);
      break;
    default:
      throw new Error(`Invalid type: type not recognised: ${element.type}`);
  }
};

// Check if the type is line or rectangle => enable adjustment
const adjustmentRequired = (type) => ["line", "rectangle"].includes(type);

const Canvas = ({
  setRawDrawingData,
  refCanvas,
  fileButtons,
  setPanelCaption,
  panelInfo,
  parsedDrawingData,
}) => {
  const [elements, setElements, undo, redo] = useHistory([], setRawDrawingData); // Setting initial history state to an empty array

  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("selection");
  const [selectedElement, setSelectedElement] = useState(null);
  const [color, setColor] = useState("000000"); // Default pen color
  const [xOffset, setxOffset] = useState(0);
  const [yOffset, setyOffset] = useState(0);

  const textAreaRef = useRef();
  const handleFill = (element) => {
    if (element) {
      const elementsCopy = [...elements];
      const index = element.id;
      const { x1, y1, x2, y2, type } = element;
      elementsCopy[index] = createElement(
        index,
        x1,
        y1,
        x2,
        y2,
        type,
        color,
        true
      );
      setElements(elementsCopy, true);
    }
  };
  useLayoutEffect(() => {
    setElements(parsedDrawingData, true, true);
  }, []);

  // useLayoutEffect(() => {
  //   setRefCanvas(refCanvas);
  // }, [elements]);

  //used LayoutEffect is called after component is fully rendered to ensure the DOM is updated before performing drawing actions
  useLayoutEffect(() => {
    //havent really looked too much into this. I think its pretty much boilerplate stuff
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // setDrawingDataUrl(canvas.toDataURL());

    //passes the HTML canvas element into rough.js
    const roughCanvas = rough.canvas(canvas);

    //iterates over the elements array and draws them on the canvas

    elements.forEach((element) => {
      if (action === "writing" && selectedElement.id === element.id) return;
      drawElement(roughCanvas, context, element);
    });
  }, [elements, action, selectedElement]);

  // Enables user to use keyboard shortcuts to undo and redo actions
  useEffect(() => {
    const undoRedoFunction = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        if (event.shiftKey) {
          redo();
        } else {
          // If ctrl + shift and any other key -> call undo func
          undo();
        }
      }
    };

    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (action === "writing" && textArea) {
      setTimeout(() => {
        textArea.focus();
      }, 50);
      textArea.value = selectedElement.text;
    }
  }, [action, selectedElement]);

  //used to update the elemetents coordinates when one is moved or resized and then sets it back into state
  //id is the identifer of the element
  // x1, y1, x2, y2 are the new coordinates
  //type - line or square
  const updateElement = (id, x1, y1, x2, y2, type, options) => {
    const elementsCopy = [...elements];

    switch (type) {
      case "line":
      case "rectangle":
        const currentElement = elementsCopy[id];
        const fill = currentElement ? currentElement.fill : false;
        elementsCopy[id] = createElement(id, x1, y1, x2, y2, type, color, fill);
        break;
      case "pencil":
        elementsCopy[id].points = [
          ...elementsCopy[id].points,
          { x: x2, y: y2 },
        ];
        break;
      case "text":
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;
        const textHeight = 24;
        elementsCopy[id] = {
          ...createElement(
            id,
            x1,
            y1,
            x1 + textWidth,
            y1 + textHeight,
            type,
            color
          ),
          text: options.text,
        };
        break;
      default:
        throw new Error(`Invalid type: type not recognised: ${type}`);
    }
    setElements(elementsCopy, true);
  };

  const handleMouseMove = (event) => {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (tool === "selection") {
      const element = getElementAtPosition(x, y, elements);
      event.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }
    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      updateElement(index, x1, y1, x, y, tool);
    } else if (action === "moving") {
      if (selectedElement.type === "pencil") {
        const newPoints = selectedElement.points.map((_, index) => ({
          x: x - selectedElement.xOffsets[index],
          y: y - selectedElement.yOffsets[index],
        }));

        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints,
        };

        setElements(elementsCopy, true);
      } else {
        const { id, x1, x2, y1, y2, type, offsetX, offsetY } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const nexX1 = x - offsetX;
        const nexY1 = y - offsetY;
        const options = type === "text" ? { text: selectedElement.text } : {};
        updateElement(id, nexX1, nexY1, nexX1 + width, nexY1 + height, type, {
          ...options,
        });
      }
    } else if (action === "resizing") {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        x,
        y,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type);
    }
  };
  const handleMouseUp = (event) => {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (selectedElement) {
      if (
        selectedElement.type === "text" &&
        x - selectedElement.offsetX === selectedElement.x1 &&
        y - selectedElement.offsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      const index = selectedElement.id;
      const { id, type } = elements[index];
      if (
        (action === "drawing" || action === "resizing") &&
        adjustmentRequired(type)
      ) {
        // Calling func to check if element needs adjustment
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }
    if (action === "writing") return;
    setAction("none");
    setRawDrawingData(elements);
    setSelectedElement(null);
  };

  // set canvas size
  const refCanvasContainer = useRef(null);
  const [size, setSize] = useState(400);
  useEffect(() => {
    setSize(
      refCanvasContainer.current.clientHeight > 400
        ? refCanvasContainer.current.clientHeight
        : 400
    );
  }, [refCanvasContainer]);

  useEffect(() => {
    setSize(refCanvasContainer.current.clientHeight);
    const rect = refCanvasContainer.current.getBoundingClientRect();
    setxOffset(rect.left);
    setyOffset(rect.top);
  }, [refCanvasContainer]);

  const handleBlur = () => {
    const { id, x1, y1, type } = selectedElement;
    setAction("none");
    setSelectedElement(null);
    updateElement(id, x1, y1, null, null, type, {
      text: textAreaRef.current.value,
    });
    textAreaRef.current.value = "";
  };

  const handleMouseDown = (event) => {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (tool === "fill") {
      const element = getElementAtPosition(x, y, elements);
      if (element) {
        handleFill(element);
      }
      return;
    }
    if (action === "writing") {
      handleBlur(event);
      return;
    }

    if (tool === "eraser") {
      const element = getElementAtPosition(x, y, elements);
      if (element) {
        setElements((elements) =>
          elements.filter((currentElement) => currentElement.id !== element.id)
        );
      }
      return;
    }

    if (tool === "selection") {
      const element = getElementAtPosition(x, y, elements);
      if (element) {
        if (element.type === "pencil") {
          const xOffsets = element.points.map((point) => x - point.x);
          const yOffsets = element.points.map((point) => y - point.y);
          setSelectedElement({ ...element, xOffsets, yOffsets });
        } else {
          const offsetX = x - element.x1;
          const offsetY = y - element.y1;
          setSelectedElement({ ...element, offsetX, offsetY });
        }
        setElements((prevState) => prevState);
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else {
      const id = elements.length;
      const element = createElement(id, x, y, x, y, tool, color);
      setElements((prevState) => [...prevState, element]);
      setSelectedElement(element);
      setAction(tool === "text" ? "writing" : "drawing");
    }
  };

  const [openInspireMe, setOpenInspireMe] = useState(false);
  const [inspireMe, setInspireMe] = useState(inspireMeGenerator());

  const handleTooltipClose = () => {
    setOpenInspireMe(false);
  };

  const handleTooltipOpen = () => {
    setOpenInspireMe(true);
  };

  return (
    <>
      <Box sx={{ display: "flex" }}>
        <ClickAwayListener onClickAway={handleTooltipClose}>
          <div>
            <Tooltip
              onClose={handleTooltipClose}
              open={openInspireMe}
              placement="top"
              arrow
              disableFocusListener
              disableHoverListener
              disableTouchListener
              title={
                <Typography
                  variant="body1"
                  sx={{ display: "inline-flex", alignItems: "center" }}
                >
                  Try... {inspireMe}
                </Typography>
              }
              slotProps={{
                popper: {
                  disablePortal: true,
                },
                tooltip: {
                  sx: { backgroundColor: "primary.dark" },
                },
                arrow: {
                  sx: { color: "primary.dark" },
                },
              }}
            >
              <Avatar
                onClick={() => {
                  handleTooltipOpen();
                  if (openInspireMe) {
                    setInspireMe(inspireMeGenerator());
                  }
                }}
                sx={{
                  bgcolor: openInspireMe ? "#FFB74D" : "primary.light",
                  color: openInspireMe ? "white" : "primary.main",
                  mr: 0.5,
                }}
                css={css`
                  :hover {
                    opacity: 0.8;
                    cursor: pointer;
                  }
                `}
              >
                <Lightbulb />
              </Avatar>
            </Tooltip>
          </div>
        </ClickAwayListener>
        {fileButtons}
        <ButtonGroup sx={{ ml: "auto", mb: 2 }}>
          <Button variant="outlined" onClick={undo}>
            <ArrowArcLeft size={20} /> <Box sx={visuallyHidden}>Undo</Box>
          </Button>
          <Button variant="outlined" onClick={redo}>
            <ArrowArcRight size={20} /> <Box sx={visuallyHidden}>Redo</Box>
          </Button>
        </ButtonGroup>
      </Box>
      <Box
        ref={refCanvasContainer}
        sx={{
          bgcolor: "rgba(255,255,255,0.9)",
          border: "3px solid",
          borderColor: "primary.light",
          aspectRatio: "1/1",
          mx: "auto",
          height: "100%",
          borderRadius: 2,
        }}
      >
        {action === "writing" ? (
          <textarea
            ref={textAreaRef}
            onBlur={handleBlur}
            style={{
              position: "absolute",
              top: selectedElement.y1 + yOffset - 108,
              left: selectedElement.x1 + xOffset - 200,
              font: "24px sans-serif",
              margin: 0,
              padding: 0,
              border: 0,
              outline: 0,
              resize: "auto",
              overflow: "hidden",
              background: "transparent",
            }}
          />
        ) : null}
        <canvas
          ref={refCanvas}
          id="canvas"
          height={size}
          width={size}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          Canvas
        </canvas>
      </Box>

      <Box sx={{ mx: "auto", my: 2, display: "flex", alignItems: "center" }}>
        <ButtonGroup>
          <Button
            variant={tool === "selection" ? "contained" : "outlined"}
            onClick={() => setTool("selection")}
          >
            <Cursor size={20} />
            <Box sx={visuallyHidden}>Move and Manipulate Object Tool</Box>
          </Button>
          <Button
            variant={tool === "line" ? "contained" : "outlined"}
            onClick={() => setTool("line")}
          >
            <LineSegment size={20} /> <Box sx={visuallyHidden}>Line Tool</Box>
          </Button>
          <Button
            variant={tool === "rectangle" ? "contained" : "outlined"}
            onClick={() => setTool("rectangle")}
          >
            <BoundingBox size={20} />
            <Box sx={visuallyHidden}>Rectangle Tool</Box>
          </Button>
          <Button
            variant={tool === "pencil" ? "contained" : "outlined"}
            onClick={() => setTool("pencil")}
          >
            <Pencil size={20} /> <Box sx={visuallyHidden}> Pencil tool </Box>
          </Button>
          <Button
            variant={tool === "eraser" ? "contained" : "outlined"}
            onClick={() => setTool("eraser")}
          >
            <Eraser size={20} /> <Box sx={visuallyHidden}> Eraser </Box>
          </Button>
          <Button
            variant={tool === "text" ? "contained" : "outlined"}
            onClick={() => setTool("text")}
          >
            <TextAa size={20} /> <Box sx={visuallyHidden}> Text</Box>
          </Button>

          <Button
            variant={tool === "fill" ? "contained" : "outlined"}
            onClick={() => setTool("fill")}
          >
            <PaintBucket size={20} /> <Box sx={visuallyHidden}> Fill </Box>
          </Button>
        </ButtonGroup>
        <ColorPicker
          value={color}
          css={css`
            & > input {
              width: 2rem;
              height: 2rem;
              border-radius: 50%;
              border: 0;
              margin-left: 1rem;
            }
          `}
          onChange={(e) => {
            setColor(e.target.value);
          }}
        />
      </Box>
    </>
  );
};
export default Canvas;
