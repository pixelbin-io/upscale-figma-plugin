import {
	localFormOptionsOptions,
	EVENTS,
	COMMANDS,
	PERSISTED_TOKEN,
	SAVED_FORM_VALUE,
	IMAGE,
	CLOUD_NAME,
	ORG_ID,
	UTM_DETAILS,
} from "../constants";
import { HOW_IT_WORKS_URL } from "../config";

//Append the UI
figma.showUI(__html__, {
	title: "Upscale.media",
	height: 400,
	width: 248,
	themeColors: true,
});

const rectangles: RectangleNode[] = [];
const {
	INITIAL_CALL,
	CREATE_FORM,
	TOGGLE_LOADER,
	IS_TOKEN_SAVED,
	SAVE_TOKEN,
	TRANSFORM,
	SELCTED_IMAGE,
	OPEN_EXTERNAL_URL,
	REPLACE_IMAGE,
	DELETE_TOKEN,
	CLOSE_PLUGIN,
} = EVENTS;

const { HOW_IT_WORKS_CMD, TOKEN_RESET_CMD } = COMMANDS;

if (figma.command === HOW_IT_WORKS_CMD)
	figma.openExternal(`${HOW_IT_WORKS_URL}?${UTM_DETAILS}`);

function toggleLoader(value: boolean) {
	figma.ui.postMessage({
		type: TOGGLE_LOADER,
		value,
	});
}

/* Handle the message from the UI */
figma.ui.onmessage = async (msg) => {
	var node: any = figma?.currentPage?.selection[0];
	var savedToken, savedCloudName, savedFormValue, orgId;
	if (msg.type === INITIAL_CALL) {
		const body = {
			type: CREATE_FORM,
			optionsArray: localFormOptionsOptions,
			savedFormValue: "",
			savedCloudName: "",
			orgId: "",
		};

		try {
			savedToken = await figma.clientStorage.getAsync(PERSISTED_TOKEN);
			savedCloudName = await figma.clientStorage.getAsync(CLOUD_NAME);
			savedFormValue = await figma.clientStorage.getAsync(SAVED_FORM_VALUE);
			orgId = await figma.clientStorage.getAsync(ORG_ID);

			if (savedToken !== undefined && savedToken !== null) {
				figma.ui.postMessage({
					type: IS_TOKEN_SAVED,
					value: true,
					isTokenEditing: figma.command === TOKEN_RESET_CMD,
					savedToken,
					savedCloudName,
					savedFormValue,
					orgId,
				});
			} else {
				figma.ui.postMessage({
					type: IS_TOKEN_SAVED,
					value: false,
					savedFormValue: "",
					isTokenEditing: figma.command === TOKEN_RESET_CMD,
				});
			}
		} catch (err) {
			figma.notify("Something wnet wrong");
		}
	}
	if (msg.type === SAVE_TOKEN) {
		figma.clientStorage
			.setAsync(PERSISTED_TOKEN, msg.value)
			.then(() => {
				figma.clientStorage
					.setAsync(CLOUD_NAME, msg.cloudName)
					.then(() => {})
					.catch(() => {});

				figma.clientStorage
					.setAsync(ORG_ID, msg.orgId)
					.then(() => {})
					.catch(() => {});

				const body = {
					type: CREATE_FORM,
					optionsArray: localFormOptionsOptions,
					savedFormValue: localFormOptionsOptions,
					cloudName: msg.cloudName,
					orgId: msg.orgId,
				};

				figma.clientStorage
					.getAsync(SAVED_FORM_VALUE)
					.then((value) => {
						body.savedFormValue = value || localFormOptionsOptions;
						figma.ui.postMessage(body);
					})
					.catch((err) => {
						figma.ui.postMessage(body);
					});
			})
			.catch((err) => {
				console.error("Error saving token:", err);
			});
	}
	if (msg.type === DELETE_TOKEN) {
		await figma.clientStorage.deleteAsync(PERSISTED_TOKEN);
		await figma.clientStorage.deleteAsync(CLOUD_NAME);
		await figma.clientStorage.deleteAsync(ORG_ID);
	}

	if (msg.type === TRANSFORM) {
		if (msg.params) {
			figma.clientStorage
				.setAsync(SAVED_FORM_VALUE, msg.params)
				.then(() => {
					console.log("Data Saved", msg.params);
				})
				.catch((err) => {
					console.error("Error saving data:", err);
				});
		}
		if (!figma.currentPage.selection.length) {
			figma.notify("Please select a image");
			return;
		}

		if (figma.currentPage.selection.length > 1) {
			figma.notify("Please select a single image");
			return;
		} else {
			node = figma.currentPage.selection[0];
			if (node.fills && node.fills.length && node.fills[0].type !== IMAGE) {
				figma.notify("Make sure you are selecting an image");
				return;
			}
			if (node.fills && node.fills.length && node.fills[0].type === IMAGE) {
				toggleLoader(true);
				const image = figma.getImageByHash(node.fills[0].imageHash);
				let bytes: any = null;
				let token = await figma.clientStorage.getAsync(PERSISTED_TOKEN);
				let savedCloudName = await figma.clientStorage.getAsync(CLOUD_NAME);
				let orgId = await figma.clientStorage.getAsync(ORG_ID);
				if (image) {
					bytes = await image.getBytesAsync();
					figma.ui.postMessage({
						type: SELCTED_IMAGE,
						imageBytes: bytes,
						imageName: node?.name?.replace(/ /g, ""),
						token,
						savedCloudName,
						orgId,
						imgHeight: node.height,
						imgWidth: node.width,
					});
				}
			} else {
				figma.notify("Make sure you are selecting an image");
				return;
			}
		}
	}
	if (msg.type === OPEN_EXTERNAL_URL) {
		figma.openExternal(msg.url);
	}
	if (msg.type === REPLACE_IMAGE) {
		figma
			.createImageAsync(msg?.transformedImageURl)
			.then(async (image: any) => {
				node.fills = [
					{
						type: IMAGE,
						imageHash: image.hash,
						scaleMode: "FILL",
					},
				];
				toggleLoader(false);
				figma.notify(
					"Transformation Applied (Use ctrl/command + z/y to undo or redo results.)",
					{ timeout: 5000 }
				);
			})
			.catch((err) => {
				switch (err) {
					case "Unable to fetch image. Response status: 403":
						figma.notify("This image can't be enhanced any more");
						break;
					case "Image is too large":
						figma.notify(
							`Figma is not able to handle result. You can find your result at : ${msg?.transformedImageURl}`,
							{ timeout: Infinity }
						);
						break;
					default:
						figma.notify("Something went wrong");
						break;
				}

				toggleLoader(false);
			});
	} else if (msg.type === CLOSE_PLUGIN) figma.closePlugin();
};
